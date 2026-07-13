import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, desc, inArray, isNull, and } from "drizzle-orm";
import {
  db,
  speakingTopicsTable,
  speakingLecturesTable,
  speakingAssignmentsTable,
  speakingPromptsTable,
  speakingAttemptsTable,
  speakingResponsesTable,
  speakingActivityTable,
} from "@workspace/db";
import {
  GetSpeakingOverviewResponse,
  GetSpeakingUnitResponse,
  GetSpeakingLectureResponse,
  GetSpeakingAssignmentResponse,
  StartSpeakingAttemptResponse,
  ListSpeakingAttemptsResponse,
  GetSpeakingAttemptResponse,
  SubmitSpeakingResponseBody,
  SubmitSpeakingResponseResponse,
  FinalizeSpeakingAttemptResponse,
  GetSpeakingProgressResponse,
  GetSpeakingFlaggedResponse,
  AskLectureTutorBody,
  AskLectureTutorResponse,
  GetLectureTutorSuggestionsResponse,
  GenerateSpeakingPracticeResponse,
  ListSpeakingPracticeResponse,
  AskPracticeTutorBody,
  AskPracticeTutorResponse,
  GetSpeakingProfileResponse,
} from "@workspace/api-zod";
import { transcribeRecording } from "../lib/speech";
import { evaluateResponse } from "../lib/evaluate";
import {
  askLectureTutor,
  suggestLectureQuestions,
  askPracticeTutor,
  type LectureContext,
  type PracticeTutorContext,
} from "../lib/tutor";
import { generatePracticePrompts } from "../lib/practice";
import { getSpeakingProfile, buildProfileContext } from "../lib/profile";
import { existingPromptTexts, practiceAssignmentIdSet } from "../lib/analytics";
import { ObjectStorageService } from "../lib/objectStorage";
import { getStudioUserId } from "../lib/studioSession";
import {
  detectAuthorship,
  type TraceInput,
  type SpokenTraceInput,
} from "../lib/detection";
import type { SpeechMetrics } from "../lib/speech";

const objectStorageService = new ObjectStorageService();

type ActivityType =
  | "practice_generated"
  | "response_graded"
  | "response_failed"
  | "attempt_finalized"
  | "tutor_lecture"
  | "tutor_practice";

async function logActivity(entry: {
  type: ActivityType;
  assignmentId?: number | null;
  attemptId?: number | null;
  responseId?: number | null;
  isPractice?: boolean;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(speakingActivityTable).values({
      type: entry.type,
      assignmentId: entry.assignmentId ?? null,
      attemptId: entry.attemptId ?? null,
      responseId: entry.responseId ?? null,
      isPractice: entry.isPractice ? 1 : 0,
      summary: entry.summary ?? null,
      payload: entry.payload ?? null,
    });
  } catch {
    // Activity logging is best-effort and must never break the request.
  }
}

const router: IRouter = Router();

const UNIT_TITLES: Record<number, { title: string; summary: string }> = {
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

function parseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(value ?? "", 10);
}

type PromptRow = typeof speakingPromptsTable.$inferSelect;
type ResponseRow = typeof speakingResponsesTable.$inferSelect;
type AttemptRow = typeof speakingAttemptsTable.$inferSelect;
type AssignmentRow = typeof speakingAssignmentsTable.$inferSelect;

async function loadPrompts(assignmentId: number) {
  const prompts = await db
    .select()
    .from(speakingPromptsTable)
    .where(eq(speakingPromptsTable.assignmentId, assignmentId))
    .orderBy(asc(speakingPromptsTable.position), asc(speakingPromptsTable.id));

  const topicIds = prompts
    .map((p) => p.topicId)
    .filter((id): id is number => id != null);
  const topics = topicIds.length
    ? await db
        .select()
        .from(speakingTopicsTable)
        .where(inArray(speakingTopicsTable.id, topicIds))
    : [];
  const topicById = new Map(topics.map((t) => [t.id, t]));

  return prompts.map((p) => {
    const topic = p.topicId != null ? topicById.get(p.topicId) : undefined;
    return {
      id: p.id,
      position: p.position,
      mode: p.mode as "spoken" | "written",
      prompt: p.prompt,
      code: topic?.code ?? null,
      topicTitle: topic?.title ?? null,
      targetSeconds: p.targetSeconds ?? null,
      rubric: p.rubric ?? null,
      guidance: p.guidance ?? null,
    };
  });
}

function assignmentMode(prompts: { mode: string }[]): "spoken" | "written" | "mixed" {
  const hasSpoken = prompts.some((p) => p.mode === "spoken");
  const hasWritten = prompts.some((p) => p.mode === "written");
  if (hasSpoken && hasWritten) return "mixed";
  if (hasWritten) return "written";
  return "spoken";
}

function serializeResponse(row: ResponseRow) {
  return {
    id: row.id,
    promptId: row.promptId,
    mode: row.mode as "spoken" | "written",
    status: row.status as "pending" | "graded" | "failed",
    textAnswer: row.textAnswer ?? null,
    recordingObjectPath: row.recordingObjectPath ?? null,
    mediaKind: (row.mediaKind as "audio" | "video" | null) ?? null,
    durationMs: row.durationMs ?? null,
    transcript: row.transcript ?? null,
    metrics: (row.metrics as Record<string, number> | null) ?? null,
    contentScore: row.contentScore ?? null,
    deliveryScore: row.deliveryScore ?? null,
    overallScore: row.overallScore ?? null,
    grade: row.grade ?? null,
    summary: row.summary ?? null,
    whatWorked: (row.whatWorked as string[] | null) ?? [],
    whatToFix: (row.whatToFix as string[] | null) ?? [],
    focusPointers: (row.focusPointers as string[] | null) ?? [],
    drills: (row.drills as string[] | null) ?? [],
    aiScore: row.aiScore ?? null,
    aiFlagged: row.aiFlagged ?? null,
    diachronicScore: row.diachronicScore ?? null,
    diachronicFlagged: row.diachronicFlagged ?? null,
    detectionRationale: row.detectionRationale ?? null,
    errorMessage: row.errorMessage ?? null,
    gradedAt: row.gradedAt ? row.gradedAt.toISOString() : null,
  };
}

async function buildAssignmentSummary(a: AssignmentRow) {
  const prompts = await db
    .select({ mode: speakingPromptsTable.mode })
    .from(speakingPromptsTable)
    .where(eq(speakingPromptsTable.assignmentId, a.id));
  const attempts = await db
    .select()
    .from(speakingAttemptsTable)
    .where(eq(speakingAttemptsTable.assignmentId, a.id))
    .orderBy(asc(speakingAttemptsTable.id));
  const submitted = attempts.filter((x) => x.status === "submitted");
  const inProgress = attempts.find((x) => x.status === "in_progress");
  const best = submitted.reduce(
    (b, x) => (x.overallScore != null && x.overallScore > b ? x.overallScore : b),
    -1,
  );
  const status: "not_started" | "in_progress" | "submitted" = inProgress
    ? "in_progress"
    : submitted.length > 0
      ? "submitted"
      : "not_started";
  const last = attempts[attempts.length - 1];
  return {
    id: a.id,
    kind: a.kind as "homework" | "test" | "capstone",
    title: a.title,
    unitNumber: a.unitNumber,
    mode: assignmentMode(prompts),
    promptCount: prompts.length,
    status,
    bestScore: best < 0 ? null : best,
    lastAttemptId: last?.id ?? null,
  };
}

async function buildUnit(unitNumber: number) {
  const lectures = await db
    .select({
      id: speakingLecturesTable.id,
      code: speakingLecturesTable.code,
      title: speakingLecturesTable.title,
    })
    .from(speakingLecturesTable)
    .where(eq(speakingLecturesTable.unitNumber, unitNumber))
    .orderBy(asc(speakingLecturesTable.position), asc(speakingLecturesTable.id));

  // Practice sets (practiceForAssignmentId set) are unofficial and excluded.
  const assignments = await db
    .select()
    .from(speakingAssignmentsTable)
    .where(
      and(
        eq(speakingAssignmentsTable.unitNumber, unitNumber),
        isNull(speakingAssignmentsTable.practiceForAssignmentId),
      ),
    )
    .orderBy(asc(speakingAssignmentsTable.position));

  const assignmentSummaries = await Promise.all(
    assignments.map(buildAssignmentSummary),
  );

  const meta = UNIT_TITLES[unitNumber] ?? {
    title: `Unit ${unitNumber}`,
    summary: "",
  };

  return {
    unitNumber,
    title: meta.title,
    summary: meta.summary,
    lectures,
    assignments: assignmentSummaries,
  };
}

async function serializeAttempt(attempt: AttemptRow) {
  const [assignment] = await db
    .select()
    .from(speakingAssignmentsTable)
    .where(eq(speakingAssignmentsTable.id, attempt.assignmentId));
  const prompts = await loadPrompts(attempt.assignmentId);
  const responses = await db
    .select()
    .from(speakingResponsesTable)
    .where(eq(speakingResponsesTable.attemptId, attempt.id))
    .orderBy(asc(speakingResponsesTable.id));

  const practiceForAssignmentId = assignment?.practiceForAssignmentId ?? null;
  let practiceParentTitle: string | null = null;
  if (practiceForAssignmentId != null) {
    const [parent] = await db
      .select({ title: speakingAssignmentsTable.title })
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, practiceForAssignmentId));
    practiceParentTitle = parent?.title ?? null;
  }

  return {
    id: attempt.id,
    assignmentId: attempt.assignmentId,
    assignmentTitle: assignment?.title ?? null,
    unitNumber: assignment?.unitNumber ?? null,
    kind: assignment?.kind ?? null,
    isPractice: practiceForAssignmentId != null,
    practiceForAssignmentId,
    practiceParentTitle,
    status: attempt.status as "in_progress" | "submitted",
    overallScore: attempt.overallScore ?? null,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    prompts,
    responses: responses.map(serializeResponse),
  };
}

router.get("/speaking/overview", async (_req, res) => {
  const units = await Promise.all([1, 2, 3, 4].map(buildUnit));
  const assignmentsTotal = units.reduce((s, u) => s + u.assignments.length, 0);
  const assignmentsCompleted = units.reduce(
    (s, u) => s + u.assignments.filter((a) => a.status === "submitted").length,
    0,
  );
  const allAttempts = await db.select().from(speakingAttemptsTable);
  const practiceIds = await practiceAssignmentIdSet();
  const officialAttempts = allAttempts.filter(
    (a) => !practiceIds.has(a.assignmentId),
  );

  res.json(
    GetSpeakingOverviewResponse.parse({
      title: "Podium — Public Speaking Studio",
      units,
      totals: {
        assignmentsCompleted,
        assignmentsTotal,
        attemptsCount: officialAttempts.length,
      },
    }),
  );
});

router.get("/speaking/units/:unitNumber", async (req, res): Promise<void> => {
  const unitNumber = parseId(req.params.unitNumber);
  if (!Number.isFinite(unitNumber) || unitNumber < 1 || unitNumber > 4) {
    res.status(404).json({ error: "unit not found" });
    return;
  }
  const unit = await buildUnit(unitNumber);
  res.json(GetSpeakingUnitResponse.parse(unit));
});

router.get("/speaking/lectures/:lectureId", async (req, res): Promise<void> => {
  const lectureId = parseId(req.params.lectureId);
  if (!Number.isFinite(lectureId)) {
    res.status(404).json({ error: "lecture not found" });
    return;
  }
  const [lecture] = await db
    .select()
    .from(speakingLecturesTable)
    .where(eq(speakingLecturesTable.id, lectureId));
  if (!lecture) {
    res.status(404).json({ error: "lecture not found" });
    return;
  }
  const meta = UNIT_TITLES[lecture.unitNumber];
  res.json(
    GetSpeakingLectureResponse.parse({
      id: lecture.id,
      unitNumber: lecture.unitNumber,
      code: lecture.code,
      title: lecture.title,
      body: lecture.body,
      unitTitle: meta?.title ?? null,
    }),
  );
});

async function loadLectureContext(
  lectureId: number,
): Promise<LectureContext | null> {
  const [lecture] = await db
    .select()
    .from(speakingLecturesTable)
    .where(eq(speakingLecturesTable.id, lectureId));
  if (!lecture) return null;
  const meta = UNIT_TITLES[lecture.unitNumber];
  return {
    unitNumber: lecture.unitNumber,
    unitTitle: meta?.title ?? null,
    code: lecture.code,
    title: lecture.title,
    body: lecture.body,
  };
}

router.post(
  "/speaking/lectures/:lectureId/tutor",
  async (req, res): Promise<void> => {
    const lectureId = parseId(req.params.lectureId);
    if (!Number.isFinite(lectureId)) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    const parsed = AskLectureTutorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid tutor request" });
      return;
    }
    const hasMessage = parsed.data.messages.some(
      (m) => m.content.trim().length > 0,
    );
    if (!hasMessage) {
      res.status(400).json({ error: "at least one message is required" });
      return;
    }
    const context = await loadLectureContext(lectureId);
    if (!context) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    try {
      const reply = await askLectureTutor(context, parsed.data.messages);
      const lastUser = [...parsed.data.messages]
        .reverse()
        .find((m) => m.role === "user");
      await logActivity({
        type: "tutor_lecture",
        summary: `Lecture tutor dialogue on "${context.title}"`,
        payload: { lectureId, question: lastUser?.content ?? null },
      });
      res.json(AskLectureTutorResponse.parse({ reply }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tutor failed";
      req.log.error({ err: error }, "Lecture tutor request failed");
      res.status(502).json({ error: message });
    }
  },
);

router.get(
  "/speaking/lectures/:lectureId/tutor/suggestions",
  async (req, res): Promise<void> => {
    const lectureId = parseId(req.params.lectureId);
    if (!Number.isFinite(lectureId)) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    const context = await loadLectureContext(lectureId);
    if (!context) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    try {
      const suggestions = await suggestLectureQuestions(context);
      res.json(GetLectureTutorSuggestionsResponse.parse({ suggestions }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tutor failed";
      req.log.error({ err: error }, "Lecture tutor suggestions failed");
      res.status(502).json({ error: message });
    }
  },
);

router.get(
  "/speaking/assignments/:assignmentId",
  async (req, res): Promise<void> => {
    const assignmentId = parseId(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }
    const [assignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, assignmentId));
    if (!assignment) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }
    const prompts = await loadPrompts(assignmentId);
    res.json(
      GetSpeakingAssignmentResponse.parse({
        id: assignment.id,
        kind: assignment.kind as "homework" | "test" | "capstone",
        title: assignment.title,
        unitNumber: assignment.unitNumber,
        instructions: assignment.instructions ?? null,
        prompts,
      }),
    );
  },
);

router.post(
  "/speaking/assignments/:assignmentId/start",
  async (req, res): Promise<void> => {
    const assignmentId = parseId(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }
    const [assignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, assignmentId));
    if (!assignment) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }

    const existing = await db
      .select()
      .from(speakingAttemptsTable)
      .where(eq(speakingAttemptsTable.assignmentId, assignmentId))
      .orderBy(desc(speakingAttemptsTable.id));
    const resume = existing.find((a) => a.status === "in_progress");

    const attempt =
      resume ??
      (
        await db
          .insert(speakingAttemptsTable)
          .values({ assignmentId })
          .returning()
      )[0]!;

    res.json(StartSpeakingAttemptResponse.parse(await serializeAttempt(attempt)));
  },
);

router.get("/speaking/attempts", async (_req, res) => {
  const attempts = await db
    .select()
    .from(speakingAttemptsTable)
    .orderBy(desc(speakingAttemptsTable.id));
  const assignmentIds = [...new Set(attempts.map((a) => a.assignmentId))];
  const assignments = assignmentIds.length
    ? await db
        .select()
        .from(speakingAssignmentsTable)
        .where(inArray(speakingAssignmentsTable.id, assignmentIds))
    : [];
  const byId = new Map(assignments.map((a) => [a.id, a]));

  // Official attempts list — practice sets are excluded from the graded record.
  const summaries = attempts
    .filter((a) => byId.get(a.assignmentId)?.practiceForAssignmentId == null)
    .map((a) => {
      const assignment = byId.get(a.assignmentId);
      return {
        id: a.id,
        assignmentId: a.assignmentId,
        assignmentTitle: assignment?.title ?? "Assignment",
        unitNumber: assignment?.unitNumber ?? 0,
        kind: assignment?.kind ?? "homework",
        isPractice: false,
        practiceForAssignmentId: null,
        status: a.status as "in_progress" | "submitted",
        overallScore: a.overallScore ?? null,
        startedAt: a.startedAt.toISOString(),
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      };
    });

  res.json(ListSpeakingAttemptsResponse.parse(summaries));
});

router.get("/speaking/attempts/:attemptId", async (req, res): Promise<void> => {
  const attemptId = parseId(req.params.attemptId);
  if (!Number.isFinite(attemptId)) {
    res.status(404).json({ error: "attempt not found" });
    return;
  }
  const [attempt] = await db
    .select()
    .from(speakingAttemptsTable)
    .where(eq(speakingAttemptsTable.id, attemptId));
  if (!attempt) {
    res.status(404).json({ error: "attempt not found" });
    return;
  }
  res.json(GetSpeakingAttemptResponse.parse(await serializeAttempt(attempt)));
});

router.post(
  "/speaking/attempts/:attemptId/responses",
  async (req: Request, res: Response): Promise<void> => {
    const attemptId = parseId(req.params.attemptId);
    if (!Number.isFinite(attemptId)) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }
    const parsed = SubmitSpeakingResponseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid response body" });
      return;
    }
    const body = parsed.data;

    const [attempt] = await db
      .select()
      .from(speakingAttemptsTable)
      .where(eq(speakingAttemptsTable.id, attemptId));
    if (!attempt) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }

    const [prompt] = await db
      .select()
      .from(speakingPromptsTable)
      .where(eq(speakingPromptsTable.id, body.promptId));
    if (!prompt || prompt.assignmentId !== attempt.assignmentId) {
      res.status(404).json({ error: "prompt not found for this attempt" });
      return;
    }

    if (body.mode !== prompt.mode) {
      res.status(400).json({
        error: `response mode "${body.mode}" does not match prompt mode "${prompt.mode}"`,
      });
      return;
    }

    if (body.mode === "spoken" && !body.recordingObjectPath) {
      res.status(400).json({ error: "recordingObjectPath is required for spoken responses" });
      return;
    }
    if (body.mode === "written" && !body.textAnswer?.trim()) {
      res.status(400).json({ error: "textAnswer is required for written responses" });
      return;
    }

    // Upsert: remove any prior response for this (attempt, prompt) pair.
    const prior = await db
      .select()
      .from(speakingResponsesTable)
      .where(eq(speakingResponsesTable.attemptId, attemptId));
    const existing = prior.find((r) => r.promptId === body.promptId);
    if (existing) {
      await db
        .delete(speakingResponsesTable)
        .where(eq(speakingResponsesTable.id, existing.id));
    }

    // Determine whether this attempt belongs to a practice set, and if so
    // build the evolving-profile context so practice grading is personalized.
    const [attemptAssignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, attempt.assignmentId));
    const isPractice = attemptAssignment?.practiceForAssignmentId != null;
    let profileContext: string | null = null;
    let parentTitle: string | null = null;
    if (isPractice) {
      try {
        profileContext = await buildProfileContext();
      } catch (error) {
        req.log.warn({ err: error }, "Failed to load profile context for practice");
      }
      const parentId = attemptAssignment?.practiceForAssignmentId ?? null;
      if (parentId != null) {
        const [parent] = await db
          .select({ title: speakingAssignmentsTable.title })
          .from(speakingAssignmentsTable)
          .where(eq(speakingAssignmentsTable.id, parentId));
        parentTitle = parent?.title ?? null;
      }
    }

    try {
      let transcript: string | null = null;
      let metrics: Record<string, number> | null = null;
      let speechMetrics: SpeechMetrics | null = null;

      if (body.mode === "spoken") {
        // Mark the freshly uploaded recording as privately owned by this
        // studio session so the /storage/objects route only serves it back to
        // the same student. Best-effort: a failure here must not block grading,
        // but it does mean the recording will be denied on playback (fail-closed).
        try {
          await objectStorageService.trySetObjectEntityAclPolicy(
            body.recordingObjectPath!,
            { owner: getStudioUserId(req, res), visibility: "private" },
          );
        } catch (aclError) {
          req.log.warn(
            { err: aclError, recordingObjectPath: body.recordingObjectPath },
            "Failed to set recording ACL policy",
          );
        }

        const result = await transcribeRecording(body.recordingObjectPath!);
        transcript = result.transcript;
        speechMetrics = result.metrics;
        metrics = result.metrics as unknown as Record<string, number>;
      }

      const answerText =
        body.mode === "spoken" ? (transcript ?? "") : (body.textAnswer ?? "");

      const evaluation = await evaluateResponse({
        mode: body.mode,
        promptText: prompt.prompt,
        rubric: prompt.rubric,
        guidance: prompt.guidance,
        targetSeconds: prompt.targetSeconds,
        transcriptOrText: answerText,
        metrics:
          body.mode === "spoken"
            ? (metrics as unknown as import("../lib/speech").SpeechMetrics)
            : null,
        isPractice,
        profileContext,
        parentTitle,
      });

      // Screen the answer for AI authorship. Written answers carry a keystroke
      // trace (enables the diachronic keystroke layer); spoken responses carry
      // no keystrokes but expose delivery metrics, which power a spoken
      // behavioral layer that catches a student reading an AI-written script
      // aloud. Detection must never block grading — any failure degrades to null
      // detection fields.
      let detection: Awaited<ReturnType<typeof detectAuthorship>> | null = null;
      try {
        const trace: TraceInput | null =
          body.mode === "written" && body.trace
            ? {
                keystrokeCount: body.trace.keystrokeCount,
                eraseCount: body.trace.eraseCount,
                bulkInsertCount: body.trace.bulkInsertCount ?? 0,
                longestBulkInsertChars: body.trace.longestBulkInsertChars ?? 0,
                rewriteSegments: body.trace.rewriteSegments ?? 0,
                durationMs: body.trace.durationMs,
              }
            : null;
        const spokenMetrics: SpokenTraceInput | null =
          body.mode === "spoken" && speechMetrics
            ? {
                wordCount: speechMetrics.wordCount,
                fillerRate: speechMetrics.fillerRate,
                pauseCount: speechMetrics.pauseCount,
                wordsPerMinute: speechMetrics.wordsPerMinute,
                fluencyScore: speechMetrics.fluencyScore,
                vocalVarietyScore: speechMetrics.vocalVarietyScore,
              }
            : null;
        detection = await detectAuthorship(answerText, trace, spokenMetrics);
      } catch (detErr) {
        req.log.error(
          { err: detErr },
          "AI-authorship detection failed; continuing without it",
        );
      }

      const [saved] = await db
        .insert(speakingResponsesTable)
        .values({
          attemptId,
          promptId: body.promptId,
          mode: body.mode,
          status: "graded",
          textAnswer: body.mode === "written" ? (body.textAnswer ?? null) : null,
          recordingObjectPath: body.recordingObjectPath ?? null,
          mediaKind: body.mediaKind ?? null,
          durationMs: body.durationMs ?? null,
          transcript,
          metrics,
          contentScore: evaluation.contentScore,
          deliveryScore: evaluation.deliveryScore,
          overallScore: evaluation.overallScore,
          grade: evaluation.grade,
          summary: evaluation.summary,
          whatWorked: evaluation.whatWorked,
          whatToFix: evaluation.whatToFix,
          focusPointers: evaluation.focusPointers,
          drills: evaluation.drills,
          aiScore: detection?.aiScore ?? null,
          aiFlagged: detection?.aiFlagged ?? null,
          diachronicScore: detection?.diachronicScore ?? null,
          diachronicFlagged: detection?.diachronicFlagged ?? null,
          detectionRationale: detection?.rationale ?? null,
          gradedAt: new Date(),
        })
        .returning();

      await logActivity({
        type: "response_graded",
        assignmentId: attempt.assignmentId,
        attemptId,
        responseId: saved!.id,
        isPractice,
        summary: `Graded ${isPractice ? "practice" : "official"} ${body.mode} response — ${evaluation.grade} (${evaluation.overallScore}/100)`,
        payload: {
          contentScore: evaluation.contentScore,
          deliveryScore: evaluation.deliveryScore,
          overallScore: evaluation.overallScore,
          grade: evaluation.grade,
        },
      });

      res.json(SubmitSpeakingResponseResponse.parse(serializeResponse(saved!)));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "evaluation failed";
      req.log.error({ err: error }, "Speaking response evaluation failed");
      const [failedRow] = await db
        .insert(speakingResponsesTable)
        .values({
          attemptId,
          promptId: body.promptId,
          mode: body.mode,
          status: "failed",
          textAnswer: body.mode === "written" ? (body.textAnswer ?? null) : null,
          recordingObjectPath: body.recordingObjectPath ?? null,
          mediaKind: body.mediaKind ?? null,
          durationMs: body.durationMs ?? null,
          errorMessage: message,
        })
        .returning();
      await logActivity({
        type: "response_failed",
        assignmentId: attempt.assignmentId,
        attemptId,
        responseId: failedRow?.id ?? null,
        isPractice,
        summary: `Evaluation failed for ${body.mode} response`,
        payload: { error: message },
      });
      res.status(502).json({ error: `Evaluation failed: ${message}` });
    }
  },
);

router.post(
  "/speaking/attempts/:attemptId/submit",
  async (req, res): Promise<void> => {
    const attemptId = parseId(req.params.attemptId);
    if (!Number.isFinite(attemptId)) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }
    const [attempt] = await db
      .select()
      .from(speakingAttemptsTable)
      .where(eq(speakingAttemptsTable.id, attemptId));
    if (!attempt) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }

    const responses = await db
      .select()
      .from(speakingResponsesTable)
      .where(eq(speakingResponsesTable.attemptId, attemptId));
    const graded = responses.filter(
      (r) => r.status === "graded" && r.overallScore != null,
    );
    const overallScore =
      graded.length > 0
        ? Math.round(
            (graded.reduce((s, r) => s + (r.overallScore ?? 0), 0) /
              graded.length) *
              100,
          ) / 100
        : null;

    const [updated] = await db
      .update(speakingAttemptsTable)
      .set({ status: "submitted", submittedAt: new Date(), overallScore })
      .where(eq(speakingAttemptsTable.id, attemptId))
      .returning();

    const [finAssignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, attempt.assignmentId));
    const finIsPractice = finAssignment?.practiceForAssignmentId != null;
    await logActivity({
      type: "attempt_finalized",
      assignmentId: attempt.assignmentId,
      attemptId,
      isPractice: finIsPractice,
      summary: `Finalized ${finIsPractice ? "practice" : "official"} attempt — ${overallScore ?? "n/a"}/100`,
      payload: { overallScore },
    });

    res.json(
      FinalizeSpeakingAttemptResponse.parse(await serializeAttempt(updated!)),
    );
  },
);

router.get("/speaking/progress", async (_req, res) => {
  const units = await Promise.all([1, 2, 3, 4].map(buildUnit));
  const allAssignmentsRaw = await db.select().from(speakingAssignmentsTable);
  // Official progress excludes practice sets entirely.
  const allAssignments = allAssignmentsRaw.filter(
    (a) => a.practiceForAssignmentId == null,
  );
  const practiceIds = new Set(
    allAssignmentsRaw
      .filter((a) => a.practiceForAssignmentId != null)
      .map((a) => a.id),
  );
  const attempts = (await db.select().from(speakingAttemptsTable)).filter(
    (a) => !practiceIds.has(a.assignmentId),
  );
  const officialAttemptIds = new Set(attempts.map((a) => a.id));
  const submitted = attempts.filter((a) => a.status === "submitted");

  const totalAssignments = allAssignments.length;
  const completedAssignments = units.reduce(
    (s, u) => s + u.assignments.filter((a) => a.status === "submitted").length,
    0,
  );

  const submittedScores = submitted
    .map((a) => a.overallScore)
    .filter((s): s is number => s != null);
  const averageScore =
    submittedScores.length > 0
      ? Math.round(
          (submittedScores.reduce((s, n) => s + n, 0) /
            submittedScores.length) *
            100,
        ) / 100
      : null;
  const bestScore =
    submittedScores.length > 0 ? Math.max(...submittedScores) : null;

  const allResponses = (await db.select().from(speakingResponsesTable)).filter(
    (r) => officialAttemptIds.has(r.attemptId),
  );
  const gradedResponses = allResponses.filter((r) => r.status === "graded");
  const contentScores = gradedResponses
    .map((r) => r.contentScore)
    .filter((s): s is number => s != null);
  const deliveryScores = gradedResponses
    .map((r) => r.deliveryScore)
    .filter((s): s is number => s != null);
  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 100) / 100
      : null;

  const unitProgress = units.map((u) => {
    const submittedInUnit = u.assignments.filter(
      (a) => a.status === "submitted" && a.bestScore != null,
    );
    return {
      unitNumber: u.unitNumber,
      title: u.title,
      completed: u.assignments.filter((a) => a.status === "submitted").length,
      total: u.assignments.length,
      averageScore:
        submittedInUnit.length > 0
          ? Math.round(
              (submittedInUnit.reduce((s, a) => s + (a.bestScore ?? 0), 0) /
                submittedInUnit.length) *
                100,
            ) / 100
          : null,
    };
  });

  // Per-topic progress: responses are linked to topics via their prompt's topicId.
  const allTopics = await db
    .select()
    .from(speakingTopicsTable)
    .orderBy(asc(speakingTopicsTable.position));
  const allPrompts = await db.select().from(speakingPromptsTable);
  const promptTopicById = new Map(
    allPrompts.map((p) => [p.id, p.topicId ?? null]),
  );
  const topicAgg = new Map<
    number,
    { responses: number; graded: number; scoreSum: number; scoreCount: number }
  >();
  for (const r of allResponses) {
    const topicId = promptTopicById.get(r.promptId);
    if (topicId == null) continue;
    const agg =
      topicAgg.get(topicId) ??
      { responses: 0, graded: 0, scoreSum: 0, scoreCount: 0 };
    agg.responses += 1;
    if (r.status === "graded") {
      agg.graded += 1;
      if (r.overallScore != null) {
        agg.scoreSum += r.overallScore;
        agg.scoreCount += 1;
      }
    }
    topicAgg.set(topicId, agg);
  }
  const topicProgress = allTopics.map((t) => {
    const agg = topicAgg.get(t.id);
    return {
      topicId: t.id,
      title: t.title,
      unitNumber: t.unitNumber,
      responses: agg?.responses ?? 0,
      gradedResponses: agg?.graded ?? 0,
      averageScore:
        agg && agg.scoreCount > 0
          ? Math.round((agg.scoreSum / agg.scoreCount) * 100) / 100
          : null,
    };
  });

  const assignmentById = new Map(allAssignments.map((a) => [a.id, a]));
  const recent = submitted
    .sort(
      (a, b) =>
        (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    )
    .slice(0, 10)
    .map((a) => {
      const assignment = assignmentById.get(a.assignmentId);
      return {
        id: a.id,
        title: assignment?.title ?? "Assignment",
        kind: assignment?.kind ?? "homework",
        at: (a.submittedAt ?? a.startedAt).toISOString(),
        score: a.overallScore ?? null,
        unitNumber: assignment?.unitNumber ?? null,
      };
    });

  res.json(
    GetSpeakingProgressResponse.parse({
      totalAssignments,
      completedAssignments,
      totalAttempts: attempts.length,
      averageScore,
      averageContent: avg(contentScores),
      averageDelivery: avg(deliveryScores),
      bestScore,
      units: unitProgress,
      topics: topicProgress,
      recent,
    }),
  );
});

router.get("/speaking/flagged", async (_req, res) => {
  // Every response that went through AI-authorship screening has an aiScore.
  // Those form the screened denominator; the flagged set is anything where the
  // static AI layer or the keystroke (diachronic) layer tripped.
  const responses = (await db.select().from(speakingResponsesTable)).filter(
    (r) => r.aiScore != null,
  );
  const flagged = responses
    .filter((r) => r.aiFlagged === true || r.diachronicFlagged === true)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const attemptIds = [...new Set(flagged.map((r) => r.attemptId))];
  const promptIds = [...new Set(flagged.map((r) => r.promptId))];
  const attempts = attemptIds.length
    ? await db
        .select()
        .from(speakingAttemptsTable)
        .where(inArray(speakingAttemptsTable.id, attemptIds))
    : [];
  const prompts = promptIds.length
    ? await db
        .select()
        .from(speakingPromptsTable)
        .where(inArray(speakingPromptsTable.id, promptIds))
    : [];
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const promptById = new Map(prompts.map((p) => [p.id, p]));

  const assignmentIds = [
    ...new Set(attempts.map((a) => a.assignmentId)),
  ];
  const assignments = assignmentIds.length
    ? await db
        .select()
        .from(speakingAssignmentsTable)
        .where(inArray(speakingAssignmentsTable.id, assignmentIds))
    : [];
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));

  const items = flagged.map((r) => {
    const attempt = attemptById.get(r.attemptId);
    const assignment = attempt
      ? assignmentById.get(attempt.assignmentId)
      : undefined;
    const prompt = promptById.get(r.promptId);
    return {
      responseId: r.id,
      attemptId: r.attemptId,
      assignmentId: assignment?.id ?? null,
      assignmentTitle: assignment?.title ?? "Assignment",
      assignmentKind: assignment?.kind ?? null,
      unitNumber: assignment?.unitNumber ?? null,
      promptText: prompt?.prompt ?? "Prompt",
      mode: r.mode as "spoken" | "written",
      isPractice: assignment?.practiceForAssignmentId != null,
      aiScore: r.aiScore ?? null,
      aiFlagged: r.aiFlagged ?? null,
      diachronicScore: r.diachronicScore ?? null,
      diachronicFlagged: r.diachronicFlagged ?? null,
      detectionRationale: r.detectionRationale ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  res.json(
    GetSpeakingFlaggedResponse.parse({
      flaggedCount: flagged.length,
      screenedCount: responses.length,
      items,
    }),
  );
});

router.post(
  "/speaking/assignments/:assignmentId/practice",
  async (req, res): Promise<void> => {
    const assignmentId = parseId(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }
    const [assignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, assignmentId));
    if (!assignment) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }
    if (assignment.practiceForAssignmentId != null) {
      res
        .status(400)
        .json({ error: "cannot generate practice from a practice set" });
      return;
    }

    const sourcePrompts = await loadPrompts(assignmentId);
    if (sourcePrompts.length === 0) {
      res.status(400).json({ error: "assignment has no prompts to mirror" });
      return;
    }
    // loadPrompts omits raw topicId, so resolve it directly for the specs.
    const sourceTopicRows = await db
      .select({
        id: speakingPromptsTable.id,
        topicId: speakingPromptsTable.topicId,
      })
      .from(speakingPromptsTable)
      .where(eq(speakingPromptsTable.assignmentId, assignmentId));
    const topicIdByPromptId = new Map(
      sourceTopicRows.map((r) => [r.id, r.topicId ?? null]),
    );

    try {
      const excludePrompts = await existingPromptTexts(assignmentId);
      const profileContext = await buildProfileContext();
      const unitMeta = UNIT_TITLES[assignment.unitNumber];

      const generated = await generatePracticePrompts({
        assignmentKind: assignment.kind,
        assignmentTitle: assignment.title,
        unitNumber: assignment.unitNumber,
        unitTitle: unitMeta?.title ?? null,
        instructions: assignment.instructions ?? null,
        specs: sourcePrompts.map((p) => ({
          mode: p.mode,
          topicId: topicIdByPromptId.get(p.id) ?? null,
          topicTitle: p.topicTitle,
          targetSeconds: p.targetSeconds,
        })),
        excludePrompts,
        profileContext,
      });

      const priorPractice = await db
        .select({ id: speakingAssignmentsTable.id })
        .from(speakingAssignmentsTable)
        .where(
          eq(speakingAssignmentsTable.practiceForAssignmentId, assignmentId),
        );
      const practiceNumber = priorPractice.length + 1;

      const [practiceAssignment] = await db
        .insert(speakingAssignmentsTable)
        .values({
          kind: assignment.kind,
          title: `Practice #${practiceNumber} — ${assignment.title}`,
          unitNumber: assignment.unitNumber,
          position: assignment.position,
          instructions: assignment.instructions ?? null,
          practiceForAssignmentId: assignmentId,
        })
        .returning();

      await db.insert(speakingPromptsTable).values(
        generated.map((g, i) => ({
          assignmentId: practiceAssignment!.id,
          topicId:
            g.topicId ??
            topicIdByPromptId.get(sourcePrompts[i]?.id ?? -1) ??
            null,
          position: i,
          mode: g.mode,
          prompt: g.prompt,
          targetSeconds: g.targetSeconds,
          rubric: g.rubric,
          guidance: g.guidance,
        })),
      );

      const [attempt] = await db
        .insert(speakingAttemptsTable)
        .values({ assignmentId: practiceAssignment!.id })
        .returning();

      await logActivity({
        type: "practice_generated",
        assignmentId: practiceAssignment!.id,
        attemptId: attempt!.id,
        isPractice: true,
        summary: `Generated practice #${practiceNumber} for "${assignment.title}" (${generated.length} prompts)`,
        payload: { parentAssignmentId: assignmentId, promptCount: generated.length },
      });

      res.json(
        GenerateSpeakingPracticeResponse.parse({
          assignmentId: practiceAssignment!.id,
          attemptId: attempt!.id,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "practice generation failed";
      req.log.error({ err: error }, "Practice generation failed");
      res.status(502).json({ error: `Practice generation failed: ${message}` });
    }
  },
);

router.get(
  "/speaking/assignments/:assignmentId/practice",
  async (req, res): Promise<void> => {
    const assignmentId = parseId(req.params.assignmentId);
    if (!Number.isFinite(assignmentId)) {
      res.status(404).json({ error: "assignment not found" });
      return;
    }

    const practiceAssignments = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(
        eq(speakingAssignmentsTable.practiceForAssignmentId, assignmentId),
      )
      .orderBy(desc(speakingAssignmentsTable.id));

    const sets = await Promise.all(
      practiceAssignments.map(async (pa) => {
        const prompts = await db
          .select({ mode: speakingPromptsTable.mode })
          .from(speakingPromptsTable)
          .where(eq(speakingPromptsTable.assignmentId, pa.id));
        const modes = new Set(prompts.map((p) => p.mode));
        const mode: "spoken" | "written" | "mixed" =
          modes.size > 1
            ? "mixed"
            : modes.has("written")
              ? "written"
              : "spoken";

        const attempts = await db
          .select()
          .from(speakingAttemptsTable)
          .where(eq(speakingAttemptsTable.assignmentId, pa.id))
          .orderBy(desc(speakingAttemptsTable.id));
        const attempt = attempts[0];

        let gradedCount = 0;
        if (attempt) {
          const responses = await db
            .select({ status: speakingResponsesTable.status })
            .from(speakingResponsesTable)
            .where(eq(speakingResponsesTable.attemptId, attempt.id));
          gradedCount = responses.filter((r) => r.status === "graded").length;
        }

        return {
          assignmentId: pa.id,
          attemptId: attempt?.id ?? 0,
          title: pa.title,
          mode,
          promptCount: prompts.length,
          status: (attempt?.status ?? "in_progress") as
            | "in_progress"
            | "submitted",
          overallScore: attempt?.overallScore ?? null,
          gradedCount,
          createdAt: pa.createdAt.toISOString(),
        };
      }),
    );

    res.json(ListSpeakingPracticeResponse.parse(sets));
  },
);

router.post(
  "/speaking/attempts/:attemptId/tutor",
  async (req, res): Promise<void> => {
    const attemptId = parseId(req.params.attemptId);
    if (!Number.isFinite(attemptId)) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }
    const parsed = AskPracticeTutorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid tutor request" });
      return;
    }
    const hasMessage = parsed.data.messages.some(
      (m) => m.content.trim().length > 0,
    );
    if (!hasMessage) {
      res.status(400).json({ error: "at least one message is required" });
      return;
    }

    const [attempt] = await db
      .select()
      .from(speakingAttemptsTable)
      .where(eq(speakingAttemptsTable.id, attemptId));
    if (!attempt) {
      res.status(404).json({ error: "attempt not found" });
      return;
    }
    const [assignment] = await db
      .select()
      .from(speakingAssignmentsTable)
      .where(eq(speakingAssignmentsTable.id, attempt.assignmentId));
    if (!assignment || assignment.practiceForAssignmentId == null) {
      res
        .status(400)
        .json({ error: "practice coach is only available in practice mode" });
      return;
    }

    let parentTitle: string | null = null;
    const [parent] = await db
      .select({ title: speakingAssignmentsTable.title })
      .from(speakingAssignmentsTable)
      .where(
        eq(speakingAssignmentsTable.id, assignment.practiceForAssignmentId),
      );
    parentTitle = parent?.title ?? null;

    const prompts = await loadPrompts(assignment.id);
    const promptById = new Map(prompts.map((p) => [p.id, p]));
    const responses = await db
      .select()
      .from(speakingResponsesTable)
      .where(eq(speakingResponsesTable.attemptId, attemptId))
      .orderBy(asc(speakingResponsesTable.id));

    const responseContexts: PracticeTutorContext["responses"] = responses.map(
      (r) => {
        const p = promptById.get(r.promptId);
        return {
          topicTitle: p?.topicTitle ?? null,
          mode: r.mode as "spoken" | "written",
          prompt: p?.prompt ?? "",
          answer: r.mode === "written" ? r.textAnswer : r.transcript,
          overallScore: r.overallScore ?? null,
          contentScore: r.contentScore ?? null,
          deliveryScore: r.deliveryScore ?? null,
          summary: r.summary ?? null,
          whatWorked: (r.whatWorked as string[] | null) ?? [],
          whatToFix: (r.whatToFix as string[] | null) ?? [],
          focusPointers: (r.focusPointers as string[] | null) ?? [],
        };
      },
    );

    const unitMeta = UNIT_TITLES[assignment.unitNumber];
    let profileContext = "";
    try {
      profileContext = await buildProfileContext();
    } catch (error) {
      req.log.warn({ err: error }, "Failed to load profile for practice tutor");
    }

    const context: PracticeTutorContext = {
      assignmentKind: assignment.kind,
      assignmentTitle: assignment.title,
      parentTitle,
      unitNumber: assignment.unitNumber,
      unitTitle: unitMeta?.title ?? null,
      responses: responseContexts,
      profileContext,
    };

    try {
      const reply = await askPracticeTutor(context, parsed.data.messages);
      const lastUser = [...parsed.data.messages]
        .reverse()
        .find((m) => m.role === "user");
      await logActivity({
        type: "tutor_practice",
        assignmentId: assignment.id,
        attemptId,
        isPractice: true,
        summary: `Practice coach dialogue on "${assignment.title}"`,
        payload: { question: lastUser?.content ?? null },
      });
      res.json(AskPracticeTutorResponse.parse({ reply }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tutor failed";
      req.log.error({ err: error }, "Practice tutor request failed");
      res.status(502).json({ error: message });
    }
  },
);

router.get("/speaking/profile", async (req, res): Promise<void> => {
  try {
    const profile = await getSpeakingProfile();
    res.json(GetSpeakingProfileResponse.parse(profile));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "profile unavailable";
    req.log.error({ err: error }, "Failed to build speaking profile");
    res.status(502).json({ error: message });
  }
});

export default router;
