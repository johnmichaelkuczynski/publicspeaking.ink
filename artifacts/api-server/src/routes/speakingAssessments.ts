import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, desc, and } from "drizzle-orm";
import { owned, studentId } from "../lib/studentContext";
import { ownsUpload } from "../lib/uploadOwnership";
import { db, speakingAssessmentsTable } from "@workspace/db";
import {
  GetSpeakingAssessmentsResponse,
  StartSpeakingAssessmentBody,
  StartSpeakingAssessmentResponse,
  BuildSpeakingAssessmentBody,
  BuildSpeakingAssessmentResponse,
  GetSpeakingAssessmentResponse,
  CompleteSpeakingAssessmentBody,
  CompleteSpeakingAssessmentResponse,
  TranscribeAssessmentRecordingBody,
  TranscribeAssessmentRecordingResponse,
} from "@workspace/api-zod";
import {
  generateAssessmentQuestions,
  type AssessmentFormat,
} from "../lib/assessments";
import { buildProfileContext } from "../lib/profile";
import { transcribeRecording, type SpeechMetrics } from "../lib/speech";
import { evaluateResponse } from "../lib/evaluate";

const router: IRouter = Router();

type AssessmentRow = typeof speakingAssessmentsTable.$inferSelect;

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

const UNITS = [1, 2, 3, 4];
const FORMATS: AssessmentFormat[] = ["spoken", "written", "hybrid", "official"];

function parseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(value ?? "", 10);
}

function formatLabel(format: string): string {
  switch (format) {
    case "spoken":
      return "Spoken";
    case "written":
      return "Written";
    case "hybrid":
      return "Hybrid";
    case "official":
      return "Official";
    default:
      return format;
  }
}

interface QuestionShape {
  prompt: string;
  mode: "spoken" | "written";
  hint: string | null;
}

function serializeQuestions(value: unknown): QuestionShape[] {
  if (!Array.isArray(value)) return [];
  return value.map((q) => {
    const item = q as { prompt?: unknown; mode?: unknown; hint?: unknown };
    return {
      prompt: typeof item.prompt === "string" ? item.prompt : "",
      mode: item.mode === "written" ? "written" : "spoken",
      hint: typeof item.hint === "string" ? item.hint : null,
    };
  });
}

function serializeAnswers(value: unknown): (string | null)[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((a) => (typeof a === "string" ? a : null));
}

interface QuestionFeedback {
  mode: "spoken" | "written";
  contentScore: number;
  deliveryScore: number | null;
  overallScore: number;
  grade: string;
  summary: string;
  whatWorked: string[];
  whatToFix: string[];
  metrics: SpeechMetrics | null;
}

function serializeFeedback(
  value: unknown,
): (QuestionFeedback | null)[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((f) => {
    if (!f || typeof f !== "object") return null;
    return f as QuestionFeedback;
  });
}

/** Coerces a client-supplied metrics payload into SpeechMetrics or null. */
function coerceMetrics(value: unknown): SpeechMetrics | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  const num = (k: string): number | null =>
    typeof m[k] === "number" && Number.isFinite(m[k]) ? (m[k] as number) : null;
  const keys = [
    "durationSeconds",
    "wordCount",
    "wordsPerMinute",
    "fillerCount",
    "fillerRate",
    "pauseCount",
    "longestPauseMs",
    "fluencyScore",
    "vocalVarietyScore",
  ];
  if (keys.some((k) => num(k) === null)) return null;
  return {
    durationSeconds: num("durationSeconds")!,
    wordCount: num("wordCount")!,
    wordsPerMinute: num("wordsPerMinute")!,
    fillerCount: num("fillerCount")!,
    fillerRate: num("fillerRate")!,
    pauseCount: num("pauseCount")!,
    longestPauseMs: num("longestPauseMs")!,
    fluencyScore: num("fluencyScore")!,
    vocalVarietyScore: num("vocalVarietyScore")!,
  };
}

/**
 * Grades every question of an assessment with Anthropic so the student always
 * gets real, per-question feedback. A spoken answer is graded on content AND
 * delivery when its measured metrics are available; otherwise it is graded on
 * content only (delivery cannot be judged without the audio measurements).
 *
 * Fail-loud: any evaluation failure rejects so the caller returns 502 and the
 * assessment is never marked complete with a fabricated or missing grade.
 */
async function gradeAssessment(
  questions: QuestionShape[],
  answers: (string | null)[],
  metricsByIndex: (SpeechMetrics | null)[],
): Promise<QuestionFeedback[]> {
  return Promise.all(
    questions.map(async (q, i) => {
      const answer = (answers[i] ?? "").trim();
      const metrics = metricsByIndex[i] ?? null;
      const gradeAsSpoken = q.mode === "spoken" && metrics != null;

      const result = await evaluateResponse({
        mode: gradeAsSpoken ? "spoken" : "written",
        promptText: q.prompt,
        transcriptOrText: answer,
        metrics: gradeAsSpoken ? metrics : null,
      });

      return {
        mode: q.mode,
        contentScore: result.contentScore,
        deliveryScore: result.deliveryScore,
        overallScore: result.overallScore,
        grade: result.grade,
        summary: result.summary,
        whatWorked: result.whatWorked,
        whatToFix: result.whatToFix,
        metrics: gradeAsSpoken ? metrics : null,
      } satisfies QuestionFeedback;
    }),
  );
}

function serializeAssessment(row: AssessmentRow) {
  const unitTitle =
    row.unitNumber != null ? (UNIT_META[row.unitNumber]?.title ?? null) : null;
  return {
    id: row.id,
    slotKey: row.slotKey,
    scope: row.scope as "before" | "after" | "custom",
    unitNumber: row.unitNumber ?? null,
    unitTitle,
    format: row.format as AssessmentFormat,
    isOfficial: row.isOfficial === 1,
    title: row.title,
    request: row.request ?? null,
    status: row.status as "in_progress" | "completed",
    questions: serializeQuestions(row.questions),
    answers: serializeAnswers(row.answers),
    feedback: serializeFeedback(row.feedback),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/**
 * The diagnostic assessment plan: 8 slots (Before + After for each of the 4
 * units), each offering four formats, plus completion credit and any custom
 * builds. Completing the "official" format of each slot drives credit.
 */
router.get("/speaking/assessments", async (_req: Request, res: Response) => {
  const all = await db
    .select()
    .from(speakingAssessmentsTable)
    .where(owned(speakingAssessmentsTable))
    .orderBy(desc(speakingAssessmentsTable.id));

  const latestByKeyFormat = new Map<string, AssessmentRow>();
  for (const row of all) {
    const key = `${row.slotKey}::${row.format}`;
    if (!latestByKeyFormat.has(key)) latestByKeyFormat.set(key, row);
  }

  const slots = [];
  let completedOfficials = 0;
  for (const scope of ["before", "after"] as const) {
    for (const unit of UNITS) {
      const slotKey = `${scope}-${unit}`;
      const meta = UNIT_META[unit];
      const formats = FORMATS.map((format) => {
        const latest = latestByKeyFormat.get(`${slotKey}::${format}`);
        const status = latest
          ? (latest.status as "in_progress" | "completed")
          : ("not_started" as const);
        if (format === "official" && status === "completed") {
          completedOfficials += 1;
        }
        return {
          format,
          isOfficial: format === "official",
          status,
          lastAssessmentId: latest?.id ?? null,
          completedAt: latest?.completedAt
            ? latest.completedAt.toISOString()
            : null,
        };
      });
      slots.push({
        key: slotKey,
        scope,
        unitNumber: unit,
        unitTitle: meta?.title ?? null,
        title: `${scope === "before" ? "Before" : "After"} — ${meta?.title ?? `Unit ${unit}`}`,
        formats,
      });
    }
  }

  const requiredOfficials = UNITS.length * 2;
  const creditMax = 20;
  const creditPercent =
    Math.round((completedOfficials / requiredOfficials) * creditMax * 100) / 100;

  const customAssessments = all
    .filter((r) => r.scope === "custom")
    .map((r) => ({
      id: r.id,
      title: r.title,
      format: r.format as AssessmentFormat,
      request: r.request ?? null,
      status: r.status as "in_progress" | "completed",
      questionCount: serializeQuestions(r.questions).length,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));

  const body = GetSpeakingAssessmentsResponse.parse({
    slots,
    credit: {
      completedOfficials,
      requiredOfficials,
      creditPercent,
      creditMax,
    },
    customAssessments,
  });
  res.json(body);
});

/**
 * Starts (or retakes) a diagnostic slot in a chosen format with fresh
 * AI-generated questions. Fails loud with a 502 if generation fails.
 */
router.post(
  "/speaking/assessments/start",
  async (req: Request, res: Response) => {
    const parsed = StartSpeakingAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request body." } });
      return;
    }
    const { slotKey, scope, format } = parsed.data;
    const unitNumber = parsed.data.unitNumber ?? null;

    try {
      const meta = unitNumber != null ? UNIT_META[unitNumber] : undefined;
      const questions = await generateAssessmentQuestions({
        scope,
        format: format as AssessmentFormat,
        unitNumber,
        unitTitle: meta?.title ?? null,
        unitSummary: meta?.summary ?? null,
        request: null,
        profileContext: await buildProfileContext(),
      });

      const title = `${scope === "before" ? "Before" : "After"} — ${meta?.title ?? `Unit ${unitNumber ?? ""}`} (${formatLabel(format)})`;

      const [row] = await db
        .insert(speakingAssessmentsTable)
        .values({
          ownerId: studentId(),
          slotKey,
          scope,
          unitNumber,
          format,
          isOfficial: format === "official" ? 1 : 0,
          title,
          request: null,
          questions,
          answers: null,
          status: "in_progress",
        })
        .returning();

      const body = StartSpeakingAssessmentResponse.parse(
        serializeAssessment(row!),
      );
      res.json(body);
    } catch (err) {
      req.log.error({ err }, "start assessment failed");
      res
        .status(502)
        .json({ error: { message: "Failed to generate the assessment." } });
    }
  },
);

/**
 * Builds a custom assessment from a free-text request with fresh questions.
 * Custom assessments are never official and do not contribute to credit.
 */
router.post(
  "/speaking/assessments/build",
  async (req: Request, res: Response) => {
    const parsed = BuildSpeakingAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request body." } });
      return;
    }
    const request = parsed.data.request.trim();
    if (!request) {
      res.status(400).json({ error: { message: "Request cannot be empty." } });
      return;
    }
    const format = (parsed.data.format ?? "hybrid") as AssessmentFormat;

    try {
      const questions = await generateAssessmentQuestions({
        scope: "custom",
        format,
        unitNumber: null,
        unitTitle: null,
        unitSummary: null,
        request,
        profileContext: await buildProfileContext(),
      });

      const title =
        request.length > 60 ? `${request.slice(0, 57)}...` : request;

      const [row] = await db
        .insert(speakingAssessmentsTable)
        .values({
          ownerId: studentId(),
          slotKey: "custom",
          scope: "custom",
          unitNumber: null,
          format,
          isOfficial: 0,
          title,
          request,
          questions,
          answers: null,
          status: "in_progress",
        })
        .returning();

      const body = BuildSpeakingAssessmentResponse.parse(
        serializeAssessment(row!),
      );
      res.json(body);
    } catch (err) {
      req.log.error({ err }, "build assessment failed");
      res
        .status(502)
        .json({ error: { message: "Failed to build the assessment." } });
    }
  },
);

/** Fetches one assessment instance with its questions and answers. */
router.get(
  "/speaking/assessments/:assessmentId",
  async (req: Request, res: Response) => {
    const id = parseId(req.params.assessmentId);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }
    const [row] = await db
      .select()
      .from(speakingAssessmentsTable)
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)));
    if (!row) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }
    const body = GetSpeakingAssessmentResponse.parse(serializeAssessment(row));
    res.json(body);
  },
);

/**
 * Records the student's answers and marks an assessment complete. Diagnostics
 * are scored for COMPLETION, not correctness — completing earns credit.
 */
router.post(
  "/speaking/assessments/:assessmentId/complete",
  async (req: Request, res: Response) => {
    const id = parseId(req.params.assessmentId);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }
    const parsed = CompleteSpeakingAssessmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request body." } });
      return;
    }

    const [existing] = await db
      .select()
      .from(speakingAssessmentsTable)
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)));
    if (!existing) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }

    const questions = serializeQuestions(existing.questions);
    const answers = parsed.data.answers.map((a) =>
      typeof a === "string" ? a : null,
    );

    // Diagnostics are scored for COMPLETION — so completing genuinely requires
    // one non-empty answer per question. Reject partial/mismatched payloads so
    // credit can never be earned without actually finishing the assessment.
    if (answers.length !== questions.length) {
      res.status(400).json({
        error: {
          message: `Expected ${questions.length} answers, received ${answers.length}.`,
        },
      });
      return;
    }
    const allAnswered = answers.every(
      (a) => typeof a === "string" && a.trim().length > 0,
    );
    if (!allAnswered) {
      res.status(400).json({
        error: {
          message: "Every question must be answered before completing.",
        },
      });
      return;
    }

    // Persist answers first so the student's work is genuinely saved even if
    // grading fails. The assessment stays in_progress until grading succeeds.
    await db
      .update(speakingAssessmentsTable)
      .set({ answers })
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)));

    // Align delivery metrics to questions (null for written/untranscribed).
    const rawMetrics = Array.isArray(parsed.data.metrics)
      ? parsed.data.metrics
      : [];
    const metricsByIndex = questions.map((_q, i) => coerceMetrics(rawMetrics[i]));

    // Grade EVERY question before marking complete. Fail loud: if grading fails
    // we keep the assessment in_progress and return 502 so the student can
    // resubmit — their answers are saved and they never get a silent no-grade.
    let feedback: QuestionFeedback[];
    try {
      feedback = await gradeAssessment(questions, answers, metricsByIndex);
    } catch (err) {
      req.log.error({ err }, "assessment grading failed");
      res.status(502).json({
        error: {
          message:
            "We couldn't grade your answers just now. Your work is saved — please submit again in a moment.",
        },
      });
      return;
    }

    const [row] = await db
      .update(speakingAssessmentsTable)
      .set({
        answers,
        feedback,
        status: "completed",
        completedAt: new Date(),
      })
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)))
      .returning();

    const body = CompleteSpeakingAssessmentResponse.parse(
      serializeAssessment(row!),
    );
    res.json(body);
  },
);

/**
 * Backfills per-question feedback for an assessment that was already completed
 * (e.g. before grading existed, or if a previous grade failed). Spoken answers
 * are graded on content only here, since the original audio metrics were not
 * retained — but the student still gets real feedback on every question.
 * Fail-loud: any grading failure returns 502 and stores nothing.
 */
router.post(
  "/speaking/assessments/:assessmentId/grade",
  async (req: Request, res: Response) => {
    const id = parseId(req.params.assessmentId);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }

    const [existing] = await db
      .select()
      .from(speakingAssessmentsTable)
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)));
    if (!existing) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }

    const questions = serializeQuestions(existing.questions);
    const answers = (serializeAnswers(existing.answers) ?? []).map((a) =>
      typeof a === "string" ? a : null,
    );
    const allAnswered =
      answers.length === questions.length &&
      answers.every((a) => typeof a === "string" && a.trim().length > 0);
    if (!allAnswered) {
      res.status(400).json({
        error: {
          message: "This assessment has no completed answers to grade.",
        },
      });
      return;
    }

    let feedback: QuestionFeedback[];
    try {
      feedback = await gradeAssessment(
        questions,
        answers,
        questions.map(() => null),
      );
    } catch (err) {
      req.log.error({ err }, "assessment regrade failed");
      res.status(502).json({
        error: {
          message: "We couldn't grade your answers just now. Please try again.",
        },
      });
      return;
    }

    const [row] = await db
      .update(speakingAssessmentsTable)
      .set({ feedback })
      .where(and(owned(speakingAssessmentsTable), eq(speakingAssessmentsTable.id, id)))
      .returning();

    const body = GetSpeakingAssessmentResponse.parse(serializeAssessment(row!));
    res.json(body);
  },
);

/**
 * POST /speaking/assessments/transcribe
 *
 * Transcribes an uploaded spoken answer so it can become the question's text
 * answer. Fail-loud: any transcription failure returns 502 rather than a
 * fabricated transcript, mirroring the attempt grading pipeline.
 */
router.post(
  "/speaking/assessments/transcribe",
  async (req: Request, res: Response) => {
    const parsed = TranscribeAssessmentRecordingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request body." } });
      return;
    }

    try {
      if (!(await ownsUpload(parsed.data.objectPath))) {
        res.status(403).json({ error: "This recording belongs to a different session." });
        return;
      }
      const { transcript, metrics } = await transcribeRecording(
        parsed.data.objectPath,
      );
      const body = TranscribeAssessmentRecordingResponse.parse({
        transcript,
        metrics,
      });
      res.json(body);
    } catch (error) {
      req.log.error({ err: error }, "Assessment transcription failed");
      res.status(502).json({
        error: {
          message:
            "Could not transcribe your recording. Please try recording again.",
        },
      });
    }
  },
);

export default router;
