import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, speakingProfileTable } from "@workspace/db";
import {
  computeSpeakingAnalytics,
  recentFeedback,
  type SpeakingAnalytics,
} from "./analytics";

const PROFILE_ID = 1;

export interface SpeakingProfile {
  summary: string | null;
  strengths: string[];
  focusAreas: string[];
  generatedAt: string | null;
  analytics: SpeakingAnalytics;
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
    throw new Error("Profile generator returned no parseable JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, max);
}

function totalResponses(a: SpeakingAnalytics): number {
  return a.gradedResponses + a.practiceResponses;
}

function analyticsDigest(a: SpeakingAnalytics): string {
  const lines: string[] = [];
  lines.push(
    `Graded responses: ${a.gradedResponses}; practice responses: ${a.practiceResponses}; tutor exchanges: ${a.tutorExchanges}.`,
  );
  if (a.averageOverall != null) {
    lines.push(
      `Average scores — overall ${a.averageOverall}, content ${a.averageContent ?? "n/a"}, delivery ${a.averageDelivery ?? "n/a"}.`,
    );
  }
  if (a.averageWordsPerMinute != null) {
    lines.push(
      `Delivery — pace ${a.averageWordsPerMinute} wpm (conversational ~110-160), filler ${a.averageFillerRate ?? "n/a"} per 100 words, ${a.averagePauseCount ?? "n/a"} long pauses per response.`,
    );
  }
  lines.push(`Trend over time: ${a.trend}.`);
  if (a.recurringFixes.length > 0) {
    lines.push(`Recurring fixes flagged: ${a.recurringFixes.join("; ")}.`);
  }
  if (a.weakTopics.length > 0) {
    lines.push(
      `Weakest topics: ${a.weakTopics.map((t) => `${t.title} (${t.averageScore})`).join("; ")}.`,
    );
  }
  if (a.strongTopics.length > 0) {
    lines.push(
      `Strongest topics: ${a.strongTopics.map((t) => `${t.title} (${t.averageScore})`).join("; ")}.`,
    );
  }
  return lines.join("\n");
}

async function generateProfile(
  analytics: SpeakingAnalytics,
): Promise<{ summary: string; strengths: string[]; focusAreas: string[] }> {
  const client = new Anthropic({ apiKey: getApiKey() });
  const feedback = await recentFeedback(12);

  const feedbackBlock = feedback
    .map((f, i) => {
      const fixes = f.whatToFix.length ? ` Fixes: ${f.whatToFix.join("; ")}.` : "";
      return `${i + 1}. [${f.mode}${f.topicTitle ? `, ${f.topicTitle}` : ""}] score ${f.overallScore ?? "n/a"}. ${f.summary ?? ""}${fixes}`;
    })
    .join("\n");

  const system = [
    "You are the head coach of Podium, a college public speaking course, maintaining an evolving profile of ONE student across everything they have done.",
    "Synthesize their measured analytics and recent feedback into a coaching profile that guides what they should work on next.",
    "Be specific, warm, and honest. Reference real patterns (pace, fillers, structure, specific topics) — never generic platitudes.",
    "Respond with ONLY a JSON object, no prose, with exactly these keys:",
    '{ "summary": string (2-4 sentences describing where this speaker is right now and the single most valuable thing to focus on), "strengths": string[] (2-4 concrete strengths), "focusAreas": string[] (2-4 concrete, prioritized areas to improve, most important first) }',
  ].join("\n");

  const user = [
    "ANALYTICS:",
    analyticsDigest(analytics),
    "",
    "RECENT FEEDBACK (most recent first):",
    feedbackBlock || "No graded responses yet.",
  ].join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 900,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = extractJson(text) as {
    summary?: unknown;
    strengths?: unknown;
    focusAreas?: unknown;
  };

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : "Keep practicing — your profile will sharpen as you log more work.",
    strengths: toStringArray(parsed.strengths, 4),
    focusAreas: toStringArray(parsed.focusAreas, 4),
  };
}

/**
 * Returns the evolving profile, regenerating the AI summary only when new graded
 * work has accumulated since it was last built. With no graded work, returns an
 * empty (encouraging) profile without calling the model. Throws on AI failure so
 * the route can fail loud with a 502.
 */
export async function getSpeakingProfile(): Promise<SpeakingProfile> {
  const analytics = await computeSpeakingAnalytics();
  const total = totalResponses(analytics);

  const [stored] = await db
    .select()
    .from(speakingProfileTable)
    .where(eq(speakingProfileTable.id, PROFILE_ID));

  if (total === 0) {
    return {
      summary: null,
      strengths: [],
      focusAreas: [],
      generatedAt: null,
      analytics,
    };
  }

  if (stored && stored.basedOnResponses === total && stored.summary) {
    return {
      summary: stored.summary,
      strengths: (stored.strengths as string[] | null) ?? [],
      focusAreas: (stored.focusAreas as string[] | null) ?? [],
      generatedAt: stored.generatedAt ? stored.generatedAt.toISOString() : null,
      analytics,
    };
  }

  const generated = await generateProfile(analytics);
  const generatedAt = new Date();

  if (stored) {
    await db
      .update(speakingProfileTable)
      .set({
        summary: generated.summary,
        strengths: generated.strengths,
        focusAreas: generated.focusAreas,
        basedOnResponses: total,
        generatedAt,
      })
      .where(eq(speakingProfileTable.id, PROFILE_ID));
  } else {
    await db.insert(speakingProfileTable).values({
      id: PROFILE_ID,
      summary: generated.summary,
      strengths: generated.strengths,
      focusAreas: generated.focusAreas,
      basedOnResponses: total,
      generatedAt,
    });
  }

  return {
    summary: generated.summary,
    strengths: generated.strengths,
    focusAreas: generated.focusAreas,
    generatedAt: generatedAt.toISOString(),
    analytics,
  };
}

/**
 * A compact, plain-text context string describing the student, injected into the
 * practice generator, the evaluator, and the practice tutor so they all coach
 * the same person. Never throws — falls back to the deterministic digest if the
 * stored AI profile is absent.
 */
export async function buildProfileContext(): Promise<string> {
  const analytics = await computeSpeakingAnalytics();
  if (totalResponses(analytics) === 0) {
    return "This is the student's first work — no performance history yet. Be welcoming and set good habits early.";
  }
  const [stored] = await db
    .select()
    .from(speakingProfileTable)
    .where(eq(speakingProfileTable.id, PROFILE_ID));

  const parts: string[] = [analyticsDigest(analytics)];
  if (stored?.summary) {
    parts.push(`Coach's read: ${stored.summary}`);
  }
  const focusAreas = (stored?.focusAreas as string[] | null) ?? [];
  if (focusAreas.length > 0) {
    parts.push(`Priority focus areas: ${focusAreas.join("; ")}.`);
  }
  return parts.join("\n");
}
