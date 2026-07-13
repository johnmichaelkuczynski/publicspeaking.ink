import Anthropic from "@anthropic-ai/sdk";
import { db, speakingAssessmentsTable } from "@workspace/db";
import {
  computeSpeakingAnalytics,
  recentFeedback,
  type SpeakingAnalytics,
} from "./analytics";
import { buildProfileContext } from "./profile";

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

/**
 * Generates a written narrative progress report synthesizing everything the
 * student has logged: measured analytics, recent feedback, diagnostic
 * assessment completion, and the coaching profile. Returns Markdown. Throws on
 * any upstream failure so the route can fail loud with a 502.
 */
export async function generateNarrativeReport(): Promise<string> {
  const client = new Anthropic({ apiKey: getApiKey() });

  const [analytics, feedback, profileContext, assessments] = await Promise.all([
    computeSpeakingAnalytics(),
    recentFeedback(12),
    buildProfileContext(),
    db.select().from(speakingAssessmentsTable),
  ]);

  const completedAssessments = assessments.filter(
    (a) => a.status === "completed",
  ).length;
  const officialsCompleted = assessments.filter(
    (a) => a.status === "completed" && a.isOfficial === 1,
  ).length;

  const feedbackBlock = feedback
    .map((f, i) => {
      const fixes = f.whatToFix.length ? ` Fixes: ${f.whatToFix.join("; ")}.` : "";
      return `${i + 1}. [${f.mode}${f.topicTitle ? `, ${f.topicTitle}` : ""}] score ${f.overallScore ?? "n/a"}. ${f.summary ?? ""}${fixes}`;
    })
    .join("\n");

  const system = [
    "You are the head coach of Podium, a college public speaking course, writing a NARRATIVE PROGRESS REPORT about ONE student for the student themselves to read.",
    "Write in warm, direct second person ('you'). Be specific and honest — cite real numbers, patterns (pace, fillers, structure), and named topics from the data. No generic platitudes.",
    "Structure the report in GitHub-flavored Markdown with these sections (use ## headers):",
    "## Where You Are Now — a 2-3 sentence honest snapshot.",
    "## What's Working — concrete strengths grounded in the data.",
    "## What to Work On — prioritized, specific focus areas, most important first.",
    "## Your Next Steps — 3-4 concrete, actionable recommendations.",
    "Keep it tight and readable — this is a report, not an essay. Output ONLY the Markdown, no preamble.",
  ].join("\n");

  const user = [
    "ANALYTICS:",
    analyticsDigest(analytics),
    "",
    `DIAGNOSTIC ASSESSMENTS: ${completedAssessments} completed (${officialsCompleted} official).`,
    "",
    "COACHING CONTEXT:",
    profileContext,
    "",
    "RECENT FEEDBACK (most recent first):",
    feedbackBlock || "No graded responses yet.",
  ].join("\n");

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 1800,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Narrative report generator returned no content");
  }
  return text;
}
