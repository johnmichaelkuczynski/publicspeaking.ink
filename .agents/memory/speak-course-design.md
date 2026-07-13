---
name: Podium speak-course design decisions
description: Intentional scope decisions for the Podium public-speaking app (speak-course) that differ from the sibling qr-course — so reviews don't re-flag them as gaps.
---

# Podium (speak-course) — intentional scope decisions

`speak-course` (student app), `speak-course-demo` (video), shared `api-server`. Mirrors qr-course but with a deliberately narrower AI-detection scope.

- **Per-submission AI-authorship detection IS now wired in** (was previously diagnostics-only). On submit, every written answer AND every spoken transcript is scored via `detectAuthorship(text, trace|null)` in api-server `lib/detection.ts` — static GPTZero/LLM/heuristic always runs; the diachronic keystroke layer only runs for written answers (spoken passes `null` trace → diachronicScore 0, no diachronic flag). Results persist on `speaking_responses` (aiScore/aiFlagged/diachronicScore/diachronicFlagged/detectionRationale) and surface in AttemptRunner's Response History as an "AI-authorship screening" callout. **Why:** detection must never block grading — it's wrapped in try/catch that degrades to null fields on failure. **How to apply:** GPTZero is aggressive (flags even hand-written prose as ~100%); that's GPTZero's classification, not a code bug.

- **Submission pipeline returns 502 on AI failure** (transcription or evaluation) and persists a `failed` response row — by design, surfaced as an explicit failure rather than a silent fallback.

- **Synthetic-run diagnostic now proves BOTH written and spoken paths end-to-end.** The spoken path uses a base64-embedded TTS fixture MP3 (`src/fixtures/diagnosticSpokenFixture.ts`) that it uploads via the real upload-URL flow, then submits through POST /speaking/attempts/:id/responses (real AssemblyAI transcribe + Anthropic grade), and cleans up both attempts + the storage object. **Why base64-embed:** esbuild bundles the server to a single dist/index.mjs, so a loose binary fixture wouldn't ship; embedding avoids path-resolution and loader config across dev/prod. Self-calls hit `http://127.0.0.1:${PORT}/api`.

- **`/storage/objects/*path` enforces ACL ownership via a studio-session cookie.** No login exists; `getStudioUserId` mints a stable httpOnly `podium_sid` per browser. The spoken-submit handler sets each recording's ACL `owner` to that id; the serving route denies (403) anything not owned by the requester's session. Objects with no ACL policy are denied (fail-closed). Single-user dev is frictionless because the same browser keeps the cookie. **Why:** path-guessing across students would otherwise leak private recordings if multi-user. **How to apply:** server-internal access (e.g. transcription) uses `getObjectEntityFile` directly and bypasses the route check — that is intentional.

- **video-js scaffold tsc noise:** `lib/video/hooks.ts`, `animations.ts`, `main.tsx` have pre-existing `window`/`document`/framer-motion `ease` errors. Scaffold-level, do NOT modify; video artifacts run via Vite, not tsc. Verify your own files are clean via `git diff` instead of chasing these.

- **Assessments are a diagnostic engine scored for COMPLETION, not correctness.** 8 official slots (before/after × 4 units) gate credit (creditMax=20, requiredOfficials=8); only `format:"official"` counts. Answers persist as plain text strings (`answers: string[]`) even for spoken-mode questions — the runner shows a mic prompt and asks the student to capture the gist in text. **Why:** the assessment contract stores text, separate from the heavy AssemblyAI/Anthropic attempt pipeline; don't wire transcription into assessments expecting per-answer grading. **How to apply:** custom builds (`scope:"custom"`) never count toward credit; completing just flips status + stores answers.
