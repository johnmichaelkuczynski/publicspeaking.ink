import Anthropic from "@anthropic-ai/sdk";

export interface PracticePromptSpec {
  mode: "spoken" | "written";
  topicId: number | null;
  topicTitle: string | null;
  targetSeconds: number | null;
}

export interface GeneratedPracticePrompt {
  mode: "spoken" | "written";
  topicId: number | null;
  prompt: string;
  guidance: string | null;
  rubric: string | null;
  targetSeconds: number | null;
}

export interface GeneratePracticeInput {
  assignmentKind: string;
  assignmentTitle: string;
  unitNumber: number;
  unitTitle: string | null;
  instructions: string | null;
  // The structure to mirror, one entry per prompt in the real assignment.
  specs: PracticePromptSpec[];
  // Prompt texts that must NOT be repeated (real prompts + every prior practice).
  excludePrompts: string[];
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
    throw new Error("Practice generator returned no parseable JSON array");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Generates a fresh practice version of an assignment: brand-new questions that
 * mirror the real assignment's structure (same modes, same topics, same count),
 * never reuse any existing prompt, and target the student's weak areas. Throws on
 * any upstream failure so the route can return a 502 instead of fabricating work.
 */
export async function generatePracticePrompts(
  input: GeneratePracticeInput,
): Promise<GeneratedPracticePrompt[]> {
  const client = new Anthropic({ apiKey: getApiKey() });

  const structure = input.specs
    .map((s, i) => {
      const target = s.targetSeconds
        ? `, target ~${s.targetSeconds}s`
        : "";
      return `${i + 1}. mode=${s.mode}${s.topicTitle ? `, topic="${s.topicTitle}"` : ""}${target}`;
    })
    .join("\n");

  const exclusions = input.excludePrompts
    .slice(0, 60)
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const system = [
    "You are a public-speaking instructor creating an UNOFFICIAL practice version of a graded assignment for ONE student in Podium, a college course.",
    "Produce brand-new questions the student can rehearse against. They must mirror the real assignment's structure exactly — same number of items, same modes, same topics, comparable length targets — but be genuinely DIFFERENT questions.",
    "NEVER reuse, lightly reword, or paraphrase any prompt in the DO-NOT-REPEAT list. Invent fresh scenarios, angles, and subject matter.",
    "Lean the questions toward the student's weak areas from their profile so practice is targeted, while staying true to the assignment's learning goals.",
    "Each item needs a clear prompt, short actionable guidance, and a concise rubric describing what a strong response includes.",
    "Respond with ONLY a JSON array, no prose, no code fences. Each element:",
    '{ "mode": "spoken"|"written", "prompt": string, "guidance": string (1-2 sentences), "rubric": string (1-2 sentences), "targetSeconds": number|null }',
    "Return exactly one element per item in the STRUCTURE, in the same order and with the same mode/targetSeconds.",
  ].join("\n");

  const user = [
    `ASSIGNMENT: ${input.assignmentKind} — "${input.assignmentTitle}"`,
    input.unitTitle ? `UNIT: ${input.unitTitle}` : `UNIT: ${input.unitNumber}`,
    input.instructions ? `INSTRUCTIONS:\n${input.instructions}` : "",
    "",
    "STRUCTURE TO MIRROR (one output item each, same order):",
    structure,
    "",
    "STUDENT PROFILE (target their weak areas):",
    input.profileContext,
    "",
    "DO-NOT-REPEAT (existing prompts — never reuse or paraphrase):",
    exclusions || "(none yet)",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 2000,
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
    throw new Error("Practice generator did not return an array");
  }

  const items = parsed as Array<{
    mode?: unknown;
    prompt?: unknown;
    guidance?: unknown;
    rubric?: unknown;
    targetSeconds?: unknown;
  }>;

  if (items.length < input.specs.length) {
    throw new Error("Practice generator returned too few items");
  }

  // Align generated items to the real structure: trust our mode/topic/target,
  // take the model's prompt/guidance/rubric.
  return input.specs.map((spec, i) => {
    const item = items[i] ?? {};
    const prompt =
      typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt) {
      throw new Error("Practice generator produced an empty prompt");
    }
    const guidance =
      typeof item.guidance === "string" && item.guidance.trim().length > 0
        ? item.guidance.trim()
        : null;
    const rubric =
      typeof item.rubric === "string" && item.rubric.trim().length > 0
        ? item.rubric.trim()
        : null;
    return {
      mode: spec.mode,
      topicId: spec.topicId,
      prompt,
      guidance,
      rubric,
      targetSeconds: spec.targetSeconds,
    };
  });
}
