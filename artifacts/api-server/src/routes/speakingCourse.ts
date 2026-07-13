import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, isNotNull, isNull, and } from "drizzle-orm";
import {
  db,
  speakingTopicsTable,
  speakingLecturesTable,
  speakingAssignmentsTable,
  speakingAttemptsTable,
  speakingResponsesTable,
  speakingActivityTable,
  speakingProfileTable,
  speakingAssessmentsTable,
} from "@workspace/db";
import {
  ResetSpeakingCourseResponse,
  GenerateSpeakingLecturesResponse,
  GenerateNarrativeReportResponse,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { generateUnitLectures } from "../lib/lectures";
import { generateNarrativeReport } from "../lib/narrative";

const router: IRouter = Router();

const UNIT_META: Record<number, { title: string; summary: string }> = {
  1: {
    title: "Unit 1 — Foundations of speaking with confidence",
    summary:
      "Managing nerves, breath and projection, posture and presence, finding your authentic voice, and analyzing your audience before you ever open your mouth.",
  },
  2: {
    title: "Unit 2 — Structuring a message that lands",
    summary:
      "Openings that hook, clear throughlines and signposting, evidence and storytelling, transitions, and closings that stick.",
  },
  3: {
    title: "Unit 3 — Delivery and presence",
    summary:
      "Pace and the power of the pause, vocal variety and emphasis, eliminating filler words, body language and gesture, handling questions, and rehearsal technique.",
  },
  4: {
    title: "Unit 4 — Persuasion, occasion, and the capstone",
    summary:
      "Persuasive appeals, speaking to persuade vs. inform, adapting to the occasion, impromptu speaking, and a full capstone speech.",
  },
};

/**
 * Wipes ALL student progress while preserving course content (topics, lectures
 * including generated ones, graded assignments, and their prompts). Deletes:
 * attempts (responses cascade), activity, profile, AI-generated practice
 * assignments (their prompts cascade), assessments, and the stored recordings.
 */
router.post("/speaking/reset", async (req: Request, res: Response) => {
  try {
    // Collect recording paths before we delete the rows.
    const recordings = await db
      .select({ path: speakingResponsesTable.recordingObjectPath })
      .from(speakingResponsesTable)
      .where(isNotNull(speakingResponsesTable.recordingObjectPath));

    // All DB deletes run atomically: either every progress artifact is wiped or
    // none is, so a mid-operation failure can never leave a half-reset course.
    const { attempts, activityRows, assessmentRows, practiceAssignments, responsesCount } =
      await db.transaction(async (tx) => {
        const attempts = await tx
          .select({ id: speakingAttemptsTable.id })
          .from(speakingAttemptsTable);
        const activityRows = await tx
          .select({ id: speakingActivityTable.id })
          .from(speakingActivityTable);
        const assessmentRows = await tx
          .select({ id: speakingAssessmentsTable.id })
          .from(speakingAssessmentsTable);
        const practiceAssignments = await tx
          .select({ id: speakingAssignmentsTable.id })
          .from(speakingAssignmentsTable)
          .where(isNotNull(speakingAssignmentsTable.practiceForAssignmentId));
        const responsesCount = (
          await tx
            .select({ id: speakingResponsesTable.id })
            .from(speakingResponsesTable)
        ).length;

        // Responses cascade from attempts; practice prompts cascade from
        // practice assignments.
        await tx.delete(speakingAttemptsTable);
        await tx.delete(speakingActivityTable);
        await tx.delete(speakingAssessmentsTable);
        await tx.delete(speakingProfileTable);
        await tx
          .delete(speakingAssignmentsTable)
          .where(isNotNull(speakingAssignmentsTable.practiceForAssignmentId));

        return { attempts, activityRows, assessmentRows, practiceAssignments, responsesCount };
      });

    // Best-effort recording cleanup — storage failures must not fail the reset.
    const storage = new ObjectStorageService();
    let recordingsDeleted = 0;
    for (const r of recordings) {
      if (!r.path) continue;
      try {
        const ok = await storage.deleteObjectEntity(r.path);
        if (ok) recordingsDeleted += 1;
      } catch (err) {
        req.log.warn({ err, path: r.path }, "reset: failed to delete recording");
      }
    }

    const body = ResetSpeakingCourseResponse.parse({
      ok: true,
      deleted: {
        attempts: attempts.length,
        responses: responsesCount,
        activity: activityRows.length,
        assessments: assessmentRows.length,
        practiceAssignments: practiceAssignments.length,
        recordings: recordingsDeleted,
      },
    });
    res.json(body);
  } catch (err) {
    req.log.error({ err }, "speaking reset failed");
    res.status(502).json({ error: { message: "Failed to reset the course." } });
  }
});

/**
 * Authors additional medium + long lecture variants for each unit that does not
 * already have generated lectures. Idempotent: units already enriched are
 * skipped. Fails loud with a 502 on any upstream generation failure.
 */
router.post("/speaking/lectures/generate", async (req: Request, res: Response) => {
  try {
    const units = [1, 2, 3, 4];
    const created: Array<{ id: number; code: string; title: string }> = [];

    for (const unit of units) {
      const existingGenerated = await db
        .select({ id: speakingLecturesTable.id })
        .from(speakingLecturesTable)
        .where(
          and(
            eq(speakingLecturesTable.unitNumber, unit),
            eq(speakingLecturesTable.generated, 1),
          ),
        );
      if (existingGenerated.length > 0) continue;

      const topics = await db
        .select()
        .from(speakingTopicsTable)
        .where(eq(speakingTopicsTable.unitNumber, unit))
        .orderBy(asc(speakingTopicsTable.position), asc(speakingTopicsTable.id));
      if (topics.length === 0) continue;

      const anchorTopicId = topics[0]!.id;
      const meta = UNIT_META[unit] ?? {
        title: `Unit ${unit}`,
        summary: "",
      };
      const topicLines = topics.map(
        (t) => `- ${t.code} ${t.title}${t.blurb ? ` — ${t.blurb}` : ""}`,
      );

      const generated = await generateUnitLectures({
        unitNumber: unit,
        unitTitle: meta.title,
        unitSummary: meta.summary,
        topicLines,
      });

      // Determine the next position so generated lectures sort after seeded ones.
      const lectureRows = await db
        .select({ position: speakingLecturesTable.position })
        .from(speakingLecturesTable)
        .where(eq(speakingLecturesTable.unitNumber, unit));
      const basePosition =
        lectureRows.reduce((m, r) => Math.max(m, r.position), 0) + 1;

      const toInsert = [
        { variant: "medium" as const, lecture: generated.medium, offset: 0 },
        { variant: "long" as const, lecture: generated.long, offset: 1 },
      ];
      for (const item of toInsert) {
        const code = `${unit}.gen-${item.variant}`;
        const [row] = await db
          .insert(speakingLecturesTable)
          .values({
            topicId: anchorTopicId,
            unitNumber: unit,
            code,
            title: item.lecture.title,
            body: item.lecture.body,
            position: basePosition + item.offset,
            length: item.variant,
            generated: 1,
          })
          .returning({
            id: speakingLecturesTable.id,
            code: speakingLecturesTable.code,
            title: speakingLecturesTable.title,
          });
        if (row) created.push(row);
      }
    }

    const body = GenerateSpeakingLecturesResponse.parse({
      ok: true,
      created: created.length,
      lectures: created,
    });
    res.json(body);
  } catch (err) {
    req.log.error({ err }, "speaking lecture generation failed");
    res
      .status(502)
      .json({ error: { message: "Failed to generate lectures." } });
  }
});

/**
 * Generates an AI narrative progress report from all logged work. Fails loud
 * with a 502 if the upstream model call fails.
 */
router.post(
  "/speaking/narrative-report",
  async (req: Request, res: Response) => {
    try {
      const report = await generateNarrativeReport();
      const body = GenerateNarrativeReportResponse.parse({
        report,
        generatedAt: new Date().toISOString(),
      });
      res.json(body);
    } catch (err) {
      req.log.error({ err }, "narrative report generation failed");
      res
        .status(502)
        .json({ error: { message: "Failed to generate the report." } });
    }
  },
);

export default router;
