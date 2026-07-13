import { AssemblyAI } from "assemblyai";
import { ObjectStorageService } from "./objectStorage";

export interface SpeechMetrics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillerRate: number;
  pauseCount: number;
  longestPauseMs: number;
  fluencyScore: number;
  vocalVarietyScore: number;
}

export interface TranscriptionResult {
  transcript: string;
  metrics: SpeechMetrics;
}

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "umm",
  "uhh",
  "erm",
  "hmm",
  "mhm",
  "ah",
  "eh",
  "like",
  "basically",
  "literally",
  "actually",
  "honestly",
]);

const PAUSE_THRESHOLD_MS = 600;

function getApiKey(): string {
  const key = process.env["ASSEMBLYAI_API_KEY"];
  if (!key) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }
  return key;
}

function normalizeWord(text: string): string {
  return text.toLowerCase().replace(/[^a-z']/g, "");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

interface AaiWord {
  text: string;
  start: number;
  end: number;
}

function computeMetrics(
  words: AaiWord[],
  audioDurationSec: number | null,
): SpeechMetrics {
  if (words.length === 0) {
    return {
      durationSeconds: round(audioDurationSec ?? 0),
      wordCount: 0,
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerRate: 0,
      pauseCount: 0,
      longestPauseMs: 0,
      fluencyScore: 0,
      vocalVarietyScore: 0,
    };
  }

  const first = words[0]!;
  const last = words[words.length - 1]!;
  const spanSec = (last.end - first.start) / 1000;
  const durationSeconds = audioDurationSec ?? spanSec;

  const wordCount = words.length;
  const minutes = durationSeconds > 0 ? durationSeconds / 60 : spanSec / 60;
  const wordsPerMinute = minutes > 0 ? wordCount / minutes : 0;

  let fillerCount = 0;
  for (const w of words) {
    if (FILLER_WORDS.has(normalizeWord(w.text))) fillerCount += 1;
  }
  const fillerRate = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;

  let pauseCount = 0;
  let longestPauseMs = 0;
  const gaps: number[] = [];
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap > 0) gaps.push(gap);
    if (gap > PAUSE_THRESHOLD_MS) pauseCount += 1;
    if (gap > longestPauseMs) longestPauseMs = gap;
  }

  // Fluency: penalize fillers and excessive long pauses relative to length.
  const pausePenalty = (pauseCount / Math.max(1, wordCount / 20)) * 6;
  const fluencyScore = clamp(100 - fillerRate * 4 - pausePenalty, 0, 100);

  // Vocal variety proxy: variation in speaking pace across the utterance.
  // AssemblyAI does not expose pitch, so this is a pace-variation proxy only.
  const durations = words
    .map((w) => w.end - w.start)
    .filter((d) => d > 0);
  let vocalVarietyScore = 0;
  if (durations.length > 1) {
    const mean =
      durations.reduce((s, d) => s + d, 0) / durations.length;
    const variance =
      durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    // A healthy delivery has moderate variation; map cv ~0.5 to a strong score.
    vocalVarietyScore = clamp(cv * 140, 0, 100);
  }

  return {
    durationSeconds: round(durationSeconds),
    wordCount,
    wordsPerMinute: round(wordsPerMinute),
    fillerCount,
    fillerRate: round(fillerRate),
    pauseCount,
    longestPauseMs: Math.round(longestPauseMs),
    fluencyScore: round(fluencyScore),
    vocalVarietyScore: round(vocalVarietyScore),
  };
}

/**
 * Downloads the recording from object storage, uploads it to AssemblyAI,
 * transcribes it (with disfluencies), and derives delivery metrics from the
 * word-level timings. Throws on any upstream failure — callers must surface a
 * 502 rather than fabricating a grade.
 */
export async function transcribeRecording(
  objectPath: string,
): Promise<TranscriptionResult> {
  const apiKey = getApiKey();
  const storage = new ObjectStorageService();
  const file = await storage.getObjectEntityFile(objectPath);
  const [buffer] = await file.download();

  const client = new AssemblyAI({ apiKey });
  const uploadUrl = await client.files.upload(buffer);

  const transcript = await client.transcripts.transcribe({
    audio: uploadUrl,
    disfluencies: true,
  });

  if (transcript.status === "error") {
    throw new Error(transcript.error ?? "AssemblyAI transcription failed");
  }

  const words: AaiWord[] = (transcript.words ?? []).map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
  }));

  const audioDurationSec =
    typeof transcript.audio_duration === "number"
      ? transcript.audio_duration
      : null;

  return {
    transcript: transcript.text ?? "",
    metrics: computeMetrics(words, audioDurationSec),
  };
}
