import { chatJson } from "./ai";

export interface TraceInput {
  keystrokeCount: number;
  eraseCount: number;
  bulkInsertCount?: number;
  longestBulkInsertChars?: number;
  rewriteSegments?: number;
  durationMs: number;
}

// Behavioral signal for spoken responses. Mirrors the relevant subset of the
// speech pipeline's SpeakingMetrics so the detector stays decoupled from how
// those metrics are derived.
export interface SpokenTraceInput {
  wordCount: number;
  fillerRate: number; // fillers per 100 words
  pauseCount: number;
  wordsPerMinute: number;
  fluencyScore: number;
  vocalVarietyScore: number;
}

export interface DetectionOutcome {
  aiScore: number;
  aiFlagged: boolean;
  diachronicScore: number;
  diachronicFlagged: boolean;
  rationale: string;
}

// Diachronic detection: keystroke pattern shows the user is rewording AI output.
// Signals: huge bulk inserts (paste-like), low keystroke-to-output ratio, very high WPM,
// or many rewrite segments on top of one initial dump.
export function diachronicScore(text: string, trace: TraceInput): number {
  const len = text.length;
  if (len < 8) return 0;

  const ks = trace.keystrokeCount;
  const longest = trace.longestBulkInsertChars ?? 0;
  const bulk = trace.bulkInsertCount ?? 0;
  const duration = Math.max(trace.durationMs, 1);
  const seconds = duration / 1000;
  const charsPerSecond = len / seconds;
  const ratio = ks / len; // typed chars per output char; near-paste -> << 1

  let score = 0;
  // Single bulk insert covering most of the answer is paste-like.
  if (longest > 40 || longest / len > 0.4) score += 0.5;
  if (bulk >= 2 && longest > 25) score += 0.15;
  // Low keystrokes vs output length.
  if (ratio < 0.6 && len > 30) score += 0.3;
  // Unrealistic typing speed.
  if (charsPerSecond > 12 && len > 30) score += 0.2;
  // Rewrite-on-top-of-paste pattern: at least one big bulk insert AND edits.
  if (longest > 30 && (trace.rewriteSegments ?? 0) >= 2) score += 0.15;

  return Math.max(0, Math.min(1, score));
}

// Spoken behavioral detection: the analogue of the keystroke diachronic layer
// for spoken responses. A student reading an AI-written script aloud (e.g. off a
// teleprompter) delivers unnaturally fluent speech — almost no filler words,
// very few pauses, and a flat, metronomic cadence — even on a long first-take
// answer where a genuine extemporaneous speaker would stumble and hesitate.
// Returns 0 for short answers, where natural fluency is plausible.
export function spokenBehavioralScore(m: SpokenTraceInput): number {
  // Only meaningful on a substantial answer; we never flag a short answer on
  // delivery alone.
  if (m.wordCount < 60) return 0;

  const pausesPer100 = m.pauseCount / (m.wordCount / 100);

  let score = 0;
  // Almost no filler words across a long answer is the strongest tell.
  if (m.fillerRate < 0.5) score += 0.35;
  else if (m.fillerRate < 1.5) score += 0.15;
  // Very few pauses relative to length — read speech rarely hesitates.
  if (pausesPer100 < 1) score += 0.3;
  else if (pausesPer100 < 2) score += 0.12;
  // Flat, metronomic cadence (low pace variation), typical of reading aloud.
  if (m.vocalVarietyScore < 20) score += 0.25;
  else if (m.vocalVarietyScore < 35) score += 0.1;
  // Reinforce when overall fluency is near-perfect on an extended take.
  if (m.fluencyScore >= 95 && m.wordCount >= 120) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

// Cheap AI-text detector: looks at structural features common in LLM prose.
// We optionally upgrade with an LLM call.
export function heuristicAiScore(text: string): number {
  const t = text.trim();
  if (t.length < 20) return 0;

  const sentences = t.split(/[.!?]+\s+/).filter((s) => s.length > 0);
  const avgLen =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    Math.max(sentences.length, 1);
  const tellTales = [
    /\bin conclusion\b/i,
    /\bmoreover\b/i,
    /\bfurthermore\b/i,
    /\bit is important to note\b/i,
    /\bdelve\b/i,
    /\btapestry\b/i,
    /\bleverag(e|ing)\b/i,
    /\bnavigat(e|ing) the\b/i,
    /\bplays? a (crucial|vital|pivotal) role\b/i,
  ];
  const hits = tellTales.reduce((n, r) => n + (r.test(t) ? 1 : 0), 0);
  const lenScore = Math.min(1, Math.max(0, (avgLen - 14) / 14));
  const hitScore = Math.min(1, hits / 3);

  return Math.min(1, lenScore * 0.4 + hitScore * 0.5);
}

// Real GPTZero API call. Returns null if no key or on failure (caller falls back).
export async function gptzeroAiScore(text: string): Promise<number | null> {
  const apiKey = process.env.GPTZERO_API_KEY;
  if (!apiKey) return null;
  const t = text.trim();
  if (t.length < 40) return null;
  try {
    const res = await fetch("https://api.gptzero.me/v2/predict/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ document: t, multilingual: false }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    // GPTZero shape: { documents: [{ class_probabilities: { ai, human, mixed }, completely_generated_prob, ... }] }
    const doc = (data as { documents?: Array<Record<string, unknown>> })?.documents?.[0];
    if (!doc) return null;
    const cls = doc.class_probabilities as
      | { ai?: number; human?: number; mixed?: number }
      | undefined;
    const cg = typeof doc.completely_generated_prob === "number"
      ? (doc.completely_generated_prob as number)
      : null;
    const aiProb =
      typeof cls?.ai === "number"
        ? cls.ai + (typeof cls.mixed === "number" ? cls.mixed * 0.5 : 0)
        : cg;
    if (typeof aiProb !== "number") return null;
    return Math.max(0, Math.min(1, aiProb));
  } catch {
    return null;
  }
}

export async function llmAiScore(text: string): Promise<number | null> {
  const t = text.trim();
  if (t.length < 40) return null;
  try {
    const out = await chatJson<{ probability: number }>(
      "You are a forensic text classifier. Given a short student response, estimate the probability (0-1) that it was produced by a large language model and not handwritten by a college freshman. Respond with strict JSON: {\"probability\": number}. Keep the number between 0 and 1.",
      t,
    );
    if (typeof out.probability === "number") {
      return Math.max(0, Math.min(1, out.probability));
    }
    return null;
  } catch {
    return null;
  }
}

// Static (text-only) AI-authorship score. Prefers GPTZero, falls back to an
// LLM scorer, and anchors both with the cheap structural heuristic. Returns the
// blended score plus whether GPTZero was the source (for rationale phrasing).
async function staticAiScore(
  text: string,
): Promise<{ score: number; gptzero: number | null }> {
  const heuristic = heuristicAiScore(text);
  const gptzero = await gptzeroAiScore(text);
  let score: number;
  if (gptzero != null) {
    // Real GPTZero result — trust it heavily, anchor with a small heuristic blend.
    score = 0.85 * gptzero + 0.15 * heuristic;
  } else {
    const llm = await llmAiScore(text);
    score = llm == null ? heuristic : 0.4 * heuristic + 0.6 * llm;
  }
  return { score, gptzero };
}

function composeRationale(
  aiScore: number,
  diaScore: number,
  gptzero: number | null,
  hasTrace: boolean,
  hasSpoken = false,
): string {
  const reasons: string[] = [];
  if (gptzero != null) {
    reasons.push(
      `GPTZero scored this response ${(gptzero * 100).toFixed(0)}% likely AI-generated.`,
    );
  }
  if (aiScore >= 0.55) reasons.push("Text patterns match common LLM outputs.");
  if (hasTrace && diaScore >= 0.55)
    reasons.push(
      "Keystroke pattern shows large bulk inserts and low typing-to-output ratio, consistent with rewording pasted AI text.",
    );
  if (hasSpoken && diaScore >= 0.55)
    reasons.push(
      "Delivery is unnaturally fluent — almost no filler words, very few pauses, and a flat, steady cadence across a long first-take answer — consistent with reading an AI-written script aloud.",
    );
  if (reasons.length === 0)
    reasons.push(
      hasTrace
        ? "No strong indicators of AI generation or AI rewording."
        : hasSpoken
          ? "No strong indicators of AI generation or scripted delivery."
          : "No strong indicators of AI generation in the text.",
    );
  return reasons.join(" ");
}

export async function detect(
  text: string,
  trace: TraceInput,
): Promise<DetectionOutcome> {
  const { score: aiScore, gptzero } = await staticAiScore(text);
  const diaScore = diachronicScore(text, trace);

  return {
    aiScore: Number(aiScore.toFixed(3)),
    aiFlagged: aiScore >= 0.55,
    diachronicScore: Number(diaScore.toFixed(3)),
    diachronicFlagged: diaScore >= 0.55,
    rationale: composeRationale(aiScore, diaScore, gptzero, true),
  };
}

// Authorship detection that gracefully handles submissions with no keystroke
// trace (e.g. spoken transcripts, where there is no typing to analyze). When a
// trace is provided the diachronic keystroke layer runs; otherwise only the
// static text classifier contributes.
export async function detectAuthorship(
  text: string,
  trace: TraceInput | null,
  spokenMetrics?: SpokenTraceInput | null,
): Promise<DetectionOutcome> {
  const { score: aiScore, gptzero } = await staticAiScore(text);
  const hasTrace = trace != null;
  // Spoken responses carry no keystroke trace; their behavioral layer is
  // derived from delivery metrics instead. The two layers are mutually
  // exclusive — a written answer has a keystroke trace, a spoken one has metrics.
  const hasSpoken = !hasTrace && spokenMetrics != null;
  const diaScore = hasTrace
    ? diachronicScore(text, trace)
    : hasSpoken
      ? spokenBehavioralScore(spokenMetrics)
      : 0;

  return {
    aiScore: Number(aiScore.toFixed(3)),
    aiFlagged: aiScore >= 0.55,
    diachronicScore: Number(diaScore.toFixed(3)),
    diachronicFlagged: (hasTrace || hasSpoken) && diaScore >= 0.55,
    rationale: composeRationale(aiScore, diaScore, gptzero, hasTrace, hasSpoken),
  };
}
