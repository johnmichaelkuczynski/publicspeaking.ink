import { eq } from "drizzle-orm";
import {
  db,
  speakingAssignmentsTable,
  speakingPromptsTable,
  speakingResponsesTable,
  speakingAttemptsTable,
  speakingTopicsTable,
  speakingActivityTable,
} from "@workspace/db";

export interface TopicStat {
  title: string;
  unitNumber: number;
  averageScore: number | null;
  responses: number;
}

export interface SpeakingAnalytics {
  gradedResponses: number;
  practiceResponses: number;
  tutorExchanges: number;
  averageContent: number | null;
  averageDelivery: number | null;
  averageOverall: number | null;
  averageWordsPerMinute: number | null;
  averageFillerRate: number | null;
  averagePauseCount: number | null;
  trend: "improving" | "declining" | "steady" | "insufficient";
  recurringFixes: string[];
  strongTopics: TopicStat[];
  weakTopics: TopicStat[];
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 100) / 100;
}

function normalizeFix(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a deterministic snapshot of the student's performance across ALL
 * responses (graded + practice). Used by the profile generator, the practice
 * generator, the tutor context, and the Coach analytics page.
 */
export async function computeSpeakingAnalytics(): Promise<SpeakingAnalytics> {
  const [assignments, prompts, responses, attempts, topics, activity] =
    await Promise.all([
      db.select().from(speakingAssignmentsTable),
      db.select().from(speakingPromptsTable),
      db.select().from(speakingResponsesTable),
      db.select().from(speakingAttemptsTable),
      db.select().from(speakingTopicsTable),
      db
        .select({ id: speakingActivityTable.id, type: speakingActivityTable.type })
        .from(speakingActivityTable),
    ]);

  const practiceAssignmentIds = new Set(
    assignments.filter((a) => a.practiceForAssignmentId != null).map((a) => a.id),
  );
  const attemptIsPractice = new Map(
    attempts.map((a) => [a.id, practiceAssignmentIds.has(a.assignmentId)]),
  );
  const promptTopicById = new Map(prompts.map((p) => [p.id, p.topicId ?? null]));
  const topicById = new Map(topics.map((t) => [t.id, t]));

  const graded = responses.filter((r) => r.status === "graded");
  const gradedReal = graded.filter((r) => !attemptIsPractice.get(r.attemptId));
  const gradedPractice = graded.filter((r) => attemptIsPractice.get(r.attemptId));

  const tutorExchanges = activity.filter(
    (a) => a.type === "tutor_lecture" || a.type === "tutor_practice",
  ).length;

  // Aggregate scores + delivery metrics across ALL graded work.
  const contentScores = graded
    .map((r) => r.contentScore)
    .filter((s): s is number => s != null);
  const deliveryScores = graded
    .map((r) => r.deliveryScore)
    .filter((s): s is number => s != null);
  const overallScores = graded
    .map((r) => r.overallScore)
    .filter((s): s is number => s != null);

  const wpm: number[] = [];
  const fillerRates: number[] = [];
  const pauseCounts: number[] = [];
  for (const r of graded) {
    const m = r.metrics as Record<string, number> | null;
    if (!m) continue;
    if (typeof m["wordsPerMinute"] === "number") wpm.push(m["wordsPerMinute"]);
    if (typeof m["fillerRate"] === "number") fillerRates.push(m["fillerRate"]);
    if (typeof m["pauseCount"] === "number") pauseCounts.push(m["pauseCount"]);
  }

  // Trend: compare the average overall of the most recent third of graded
  // responses against the earliest third (chronological by id).
  const chrono = [...graded]
    .filter((r) => r.overallScore != null)
    .sort((a, b) => a.id - b.id);
  let trend: SpeakingAnalytics["trend"] = "insufficient";
  if (chrono.length >= 6) {
    const third = Math.max(1, Math.floor(chrono.length / 3));
    const first = chrono.slice(0, third);
    const last = chrono.slice(-third);
    const firstAvg = avg(first.map((r) => r.overallScore!)) ?? 0;
    const lastAvg = avg(last.map((r) => r.overallScore!)) ?? 0;
    const delta = lastAvg - firstAvg;
    trend = delta >= 3 ? "improving" : delta <= -3 ? "declining" : "steady";
  }

  // Recurring fixes: count normalized whatToFix items, surface the top themes.
  const fixCounts = new Map<string, { label: string; count: number }>();
  for (const r of graded) {
    const fixes = (r.whatToFix as string[] | null) ?? [];
    for (const fix of fixes) {
      const key = normalizeFix(fix);
      if (key.length < 4) continue;
      const entry = fixCounts.get(key) ?? { label: fix.trim(), count: 0 };
      entry.count += 1;
      fixCounts.set(key, entry);
    }
  }
  const recurringFixes = [...fixCounts.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((e) => e.label);

  // Per-topic averages across all graded responses.
  const topicAgg = new Map<number, { sum: number; count: number; responses: number }>();
  for (const r of graded) {
    const topicId = promptTopicById.get(r.promptId);
    if (topicId == null) continue;
    const agg = topicAgg.get(topicId) ?? { sum: 0, count: 0, responses: 0 };
    agg.responses += 1;
    if (r.overallScore != null) {
      agg.sum += r.overallScore;
      agg.count += 1;
    }
    topicAgg.set(topicId, agg);
  }
  const topicStats: TopicStat[] = [];
  for (const [topicId, agg] of topicAgg) {
    const topic = topicById.get(topicId);
    if (!topic || agg.count === 0) continue;
    topicStats.push({
      title: topic.title,
      unitNumber: topic.unitNumber,
      averageScore: Math.round((agg.sum / agg.count) * 100) / 100,
      responses: agg.responses,
    });
  }
  const ranked = [...topicStats].sort(
    (a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0),
  );
  const weakTopics = ranked.slice(0, 3);
  const strongTopics = [...ranked].reverse().slice(0, 3);

  return {
    gradedResponses: gradedReal.length,
    practiceResponses: gradedPractice.length,
    tutorExchanges,
    averageContent: avg(contentScores),
    averageDelivery: avg(deliveryScores),
    averageOverall: avg(overallScores),
    averageWordsPerMinute: avg(wpm),
    averageFillerRate: avg(fillerRates),
    averagePauseCount: avg(pauseCounts),
    trend,
    recurringFixes,
    strongTopics,
    weakTopics,
  };
}

export interface RecentFeedback {
  topicTitle: string | null;
  mode: string;
  overallScore: number | null;
  summary: string | null;
  whatToFix: string[];
}

/**
 * The most recent graded responses (across graded + practice) with their
 * feedback, used to give the profile generator concrete, current material.
 */
export async function recentFeedback(limit = 12): Promise<RecentFeedback[]> {
  const responses = await db.select().from(speakingResponsesTable);
  const prompts = await db.select().from(speakingPromptsTable);
  const topics = await db.select().from(speakingTopicsTable);
  const promptTopicById = new Map(prompts.map((p) => [p.id, p.topicId ?? null]));
  const topicById = new Map(topics.map((t) => [t.id, t]));

  return responses
    .filter((r) => r.status === "graded")
    .sort((a, b) => b.id - a.id)
    .slice(0, limit)
    .map((r) => {
      const topicId = promptTopicById.get(r.promptId);
      const topic = topicId != null ? topicById.get(topicId) : undefined;
      return {
        topicTitle: topic?.title ?? null,
        mode: r.mode,
        overallScore: r.overallScore ?? null,
        summary: r.summary ?? null,
        whatToFix: (r.whatToFix as string[] | null) ?? [],
      };
    });
}

/**
 * Helper used elsewhere to know which assignment ids are practice sets so they
 * can be filtered out of official progress.
 */
export async function practiceAssignmentIdSet(): Promise<Set<number>> {
  const rows = await db
    .select({
      id: speakingAssignmentsTable.id,
      practiceForAssignmentId: speakingAssignmentsTable.practiceForAssignmentId,
    })
    .from(speakingAssignmentsTable);
  return new Set(
    rows.filter((r) => r.practiceForAssignmentId != null).map((r) => r.id),
  );
}

/**
 * Resolves the prompt-text of a graded assignment plus all of its prior
 * practice prompts, so generation never repeats either.
 */
export async function existingPromptTexts(
  gradedAssignmentId: number,
): Promise<string[]> {
  const practiceAssignments = await db
    .select({ id: speakingAssignmentsTable.id })
    .from(speakingAssignmentsTable)
    .where(
      eq(speakingAssignmentsTable.practiceForAssignmentId, gradedAssignmentId),
    );
  const ids = [gradedAssignmentId, ...practiceAssignments.map((a) => a.id)];
  const prompts = await db.select().from(speakingPromptsTable);
  return prompts
    .filter((p) => ids.includes(p.assignmentId))
    .map((p) => p.prompt);
}
