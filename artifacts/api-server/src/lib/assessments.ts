import Anthropic from "@anthropic-ai/sdk";

export type AssessmentFormat = "spoken" | "written" | "hybrid" | "official";
export type AssessmentScope = "before" | "after" | "custom";

export interface GeneratedAssessmentQuestion {
  prompt: string;
  mode: "spoken" | "written";
  hint: string | null;
}

export interface GenerateAssessmentInput {
  scope: AssessmentScope;
  format: AssessmentFormat;
  unitNumber: number | null;
  unitTitle: string | null;
  unitSummary: string | null;
  request: string | null;
  profileContext: string;
}

function getApiKey(): string {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return key;
}

function getModel(): string {
  return process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5";
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Assessment generator returned no parseable JSON array");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function questionCount(format: AssessmentFormat): number {
  switch (format) {
    case "official":
      return 6;
    case "hybrid":
      return 5;
    default:
      return 4;
  }
}

function modeGuidance(format: AssessmentFormat): string {
  switch (format) {
    case "spoken":
      return 'Every question MUST have mode "spoken" — the student answers out loud into the mic.';
    case "written":
      return 'Every question MUST have mode "written" — the student types a short reflective answer.';
    case "hybrid":
      return 'Mix the modes: roughly half "spoken" and half "written", interleaved.';
    case "official":
      return 'This is the OFFICIAL graded-for-completion diagnostic. Favor "spoken" questions (this is a spoken-first course) but include at least one "written" reflection. It should be the most comprehensive of the formats.';
  }
}

/**
 * Generates fresh diagnostic questions for one assessment instance. Questions are
 * scored for COMPLETION, not correctness — they are designed to make the student
 * actively demonstrate where they are. Throws on any upstream failure so the
 * route can return a 502 instead of fabricating an assessment.
 */
export async function generateAssessmentQuestions(
  input: GenerateAssessmentInput,
): Promise<GeneratedAssessmentQuestion[]> {
  const client = new Anthropic({ apiKey: getApiKey() });
  const count = questionCount(input.format);

  const focus =
    input.scope === "custom"
      ? `CUSTOM REQUEST from the student (build the assessment around this): "${input.request ?? ""}"`
      : input.scope === "before"
        ? `This is a BEFORE diagnostic taken at the START of ${input.unitTitle ?? `Unit ${input.unitNumber}`}. Probe what the student already knows and can do, and surface their starting point and gaps before they study the unit.`
        : `This is an AFTER diagnostic taken at the END of ${input.unitTitle ?? `Unit ${input.unitNumber}`}. Probe whether the student has internalized the unit's skills and can apply them.`;

  const system = [
    "You are an assessment designer for Podium, a college public speaking course, building a DIAGNOSTIC assessment for ONE student.",
    "Diagnostics are scored for COMPLETION, not correctness: write open, thought-provoking questions that make the student actively reflect on or demonstrate their public-speaking ability. There are no trick questions and no single right answer.",
    modeGuidance(input.format),
    "Each question needs a clear prompt and a short, encouraging hint that tells the student what a thorough answer would touch on.",
    "Tailor difficulty and topic to the student's profile so the diagnostic is genuinely informative for them.",
    "Respond with ONLY a JSON array, no prose, no code fences. Each element:",
    '{ "prompt": string, "mode": "spoken"|"written", "hint": string }',
    `Return exactly ${count} questions.`,
  ].join("\n");

  const user = [
    focus,
    input.unitSummary ? `UNIT FOCUS: ${input.unitSummary}` : "",
    "",
    "STUDENT PROFILE (tailor to them):",
    input.profileContext,
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 1600,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Assessment generator did not return an array");
  }

  const items = parsed as Array<{
    prompt?: unknown;
    mode?: unknown;
    hint?: unknown;
  }>;

  const questions: GeneratedAssessmentQuestion[] = items
    .map((item) => {
      const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
      if (!prompt) return null;
      const mode: "spoken" | "written" =
        item.mode === "written" ? "written" : "spoken";
      const hint =
        typeof item.hint === "string" && item.hint.trim().length > 0
          ? item.hint.trim()
          : null;
      return { prompt, mode, hint };
    })
    .filter((q): q is GeneratedAssessmentQuestion => q !== null);

  if (questions.length === 0) {
    throw new Error("Assessment generator produced no usable questions");
  }

  return questions;
}
