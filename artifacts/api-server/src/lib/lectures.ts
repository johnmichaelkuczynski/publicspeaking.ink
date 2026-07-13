import Anthropic from "@anthropic-ai/sdk";

export interface GeneratedLecture {
  title: string;
  body: string;
}

export interface GenerateUnitLecturesInput {
  unitNumber: number;
  unitTitle: string;
  unitSummary: string;
  topicLines: string[];
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

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Lecture generator returned no parseable JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Authors two additional lecture variants for a unit: a "medium" connective
 * overview that ties the unit's topics together, and a "long" deep-dive that
 * goes further with extended technique, examples, and drills. Returns Markdown
 * bodies. Throws on any upstream failure so the route can fail loud with a 502.
 */
export async function generateUnitLectures(
  input: GenerateUnitLecturesInput,
): Promise<{ medium: GeneratedLecture; long: GeneratedLecture }> {
  const client = new Anthropic({ apiKey: getApiKey() });

  const system = [
    "You are the lead instructor of Podium, a college public speaking course. You are authoring two ADDITIONAL lecture variants for one unit, beyond the existing short per-topic lectures.",
    "Write genuinely useful instructional prose in GitHub-flavored Markdown (use #/## headers, bold, and lists). This is a spoken-first course — emphasize what to actually DO with your voice and body, with concrete techniques and examples.",
    "Produce TWO lectures:",
    '- "medium": a connective ~400-600 word overview that synthesizes the unit\'s topics into one coherent throughline a student can read in a few minutes.',
    '- "long": an in-depth ~900-1300 word deep-dive that goes further than the short lectures — extended technique, worked examples, common mistakes, and a short set of rehearsal drills at the end.',
    "Respond with ONLY a JSON object, no prose, no code fences:",
    '{ "medium": { "title": string, "body": string (markdown) }, "long": { "title": string, "body": string (markdown) } }',
  ].join("\n");

  const user = [
    `UNIT: ${input.unitTitle}`,
    `UNIT FOCUS: ${input.unitSummary}`,
    "",
    "TOPICS COVERED IN THIS UNIT (synthesize these, don't just repeat them):",
    input.topicLines.join("\n"),
  ].join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = extractJson(text) as {
    medium?: { title?: unknown; body?: unknown };
    long?: { title?: unknown; body?: unknown };
  };

  const coerce = (
    v: { title?: unknown; body?: unknown } | undefined,
    fallbackTitle: string,
  ): GeneratedLecture => {
    const body = typeof v?.body === "string" ? v.body.trim() : "";
    if (!body) {
      throw new Error("Lecture generator produced an empty lecture body");
    }
    const title =
      typeof v?.title === "string" && v.title.trim().length > 0
        ? v.title.trim()
        : fallbackTitle;
    return { title, body };
  };

  return {
    medium: coerce(parsed.medium, `${input.unitTitle} — Overview`),
    long: coerce(parsed.long, `${input.unitTitle} — Deep Dive`),
  };
}
