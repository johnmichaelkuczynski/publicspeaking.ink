# Podium — Architecture Blueprint

This document is the long-form companion to `README.md`. The README says *what* Podium is; this says *how it is built*. It is kept in lock-step with the code.

Podium is the **Public Speaking Studio** artifact in a Replit pnpm monorepo. It shares the monorepo's backend (`artifacts/api-server`), generated API client (`@workspace/api-client-react`), Zod contract (`@workspace/api-zod`), and database (`@workspace/db`) with the other course artifacts, but is an independent product with its own curriculum, pages, and grading pipeline.

---

## 1. Monorepo Placement

```
artifacts/
  speak-course/        # this app — React + Vite frontend (Podium)
  api-server/          # shared Express backend (serves /api/speaking/*)
lib/
  db/                  # Drizzle schema incl. speaking_* tables
  api-spec/            # OpenAPI source of truth
  api-zod/             # generated Zod validators (server)
  api-client-react/    # generated React Query hooks (client)
```

The frontend is served under the path prefix `/speak-course/`; the backend is served under `/api` by the shared proxy. The frontend talks to the backend through generated hooks (base URL `/api`) and, for diagnostics, through plain `fetch("/api/speaking/...")`.

---

## 2. Data Model (`lib/db/src/schema/speaking.ts`)

All tables are prefixed `speaking_` to keep them isolated from the other course's tables in the same database.

- **speaking_topics** — 29 topics across 4 units (`code`, `title`, `unitNumber`, `blurb`, `position`).
- **speaking_lectures** — one lecture per topic (`topicId`, `unitNumber`, `code`, `title`, `body` markdown, `position`).
- **speaking_assignments** — homework, tests, and the capstone (`kind`, `title`, `unitNumber`, `instructions`, `position`).
- **speaking_prompts** — the questions inside an assignment (`assignmentId`, `topicId?`, `mode` = `spoken | written`, `prompt`, `targetSeconds?`, `rubric?`, `guidance?`).
- **speaking_attempts** — a student's run at an assignment (`assignmentId`, `status` = `in_progress | submitted`, `startedAt`, `submittedAt?`, `overallScore?`).
- **speaking_responses** — one graded answer per prompt (`attemptId`, `promptId`, `mode`, `status` = `pending | graded | failed`, `textAnswer?`, `recordingObjectPath?`, `mediaKind?`, `durationMs?`, `transcript?`, `metrics` jsonb, `contentScore?`, `deliveryScore?`, `overallScore?`, `grade?`, `summary?`, `whatWorked` jsonb, `whatToFix` jsonb, `errorMessage?`, `gradedAt?`).

Seed data is produced by `artifacts/api-server/src/lib/seedSpeaking.ts`, which is idempotent and runs on server start. The four units are:

1. **Foundations of speaking with confidence** (topics 1.1–1.7)
2. **Structuring a message that lands** (topics 2.1–2.7)
3. **Delivery and presence** (topics 3.1–3.7)
4. **Persuasion, occasion, and the capstone** (topics 4.1–4.8, where 4.8 is the Capstone)

---

## 3. API Surface (`artifacts/api-server/src/routes/speaking.ts`)

All routes are contract-bound: responses are validated with Zod schemas from `@workspace/api-zod` before being sent.

| Method & Path | Purpose |
| --- | --- |
| `GET /api/speaking/overview` | Course overview: units, lectures, assignment summaries, totals. |
| `GET /api/speaking/units/:unitNumber` | One unit's lectures and assignment summaries. |
| `GET /api/speaking/lectures/:lectureId` | A single lecture body (markdown). |
| `GET /api/speaking/assignments/:assignmentId` | Assignment detail with its prompts. |
| `POST /api/speaking/assignments/:assignmentId/start` | Start (or resume) an attempt. |
| `GET /api/speaking/attempts` | List all attempts with status/score. |
| `GET /api/speaking/attempts/:attemptId` | Full attempt: prompts + responses. |
| `POST /api/speaking/attempts/:attemptId/responses` | Submit one response (spoken or written) → grade. |
| `POST /api/speaking/attempts/:attemptId/submit` | Finalize an attempt; roll up the overall score. |
| `GET /api/speaking/progress` | Analytics: per-unit mastery, per-topic mastery, averages, recent activity. |

Diagnostics live in `speakingDiagnostics.ts`:

| Method & Path | Purpose |
| --- | --- |
| `GET /api/speaking/diagnostics/system` | Stack health: env, DB, seed, OpenAI, Anthropic, AssemblyAI, GPTZero. |
| `POST /api/speaking/diagnostics/synthetic-run` | End-to-end written-reflection run, then self-clean. |

---

## 4. The Spoken Submission Pipeline

This is the core of Podium and the part that differs most from a typical text-graded course.

1. **Record (browser).** The attempt runner uses `MediaRecorder` over `getUserMedia` to capture audio (optionally video). It tracks duration and produces a `Blob`.
2. **Request upload URL.** `POST /api/storage/uploads/request-url` returns a presigned `uploadURL` and the canonical `objectPath` (`/objects/<id>`).
3. **Upload.** The browser `PUT`s the blob directly to `uploadURL` with its `Content-Type`.
4. **Submit.** `POST /api/speaking/attempts/:attemptId/responses` with `{ promptId, mode: "spoken", recordingObjectPath, mediaKind, durationMs }`.
5. **Transcribe (server, `lib/speech.ts`).** The server downloads the object, uploads it to **AssemblyAI**, and transcribes with disfluencies on. Word-level timings are turned into delivery metrics: words/min, filler count + rate, pause count + longest pause, fluency proxy, pace-variation proxy.
6. **Grade (server, `lib/evaluate.ts`).** **Anthropic** receives the prompt, rubric, target length, delivery metrics, and transcript, and returns `contentScore`, `deliveryScore`, `summary`, `whatWorked`, `whatToFix`. Overall = `0.5 × content + 0.5 × delivery` for spoken; content-only for written.
7. **Persist + respond.** The graded response is stored and returned. On any upstream failure the response is stored as `failed` and the route returns **502** — never a fabricated grade.

Written reflections skip steps 1–5: the textarea content goes straight to the evaluator with `deliveryScore = null`.

Playback of a stored recording uses `GET /api/storage/objects/<id>` as the media `src`.

---

## 5. Frontend (`artifacts/speak-course/src`)

React + Vite + wouter + React Query + shadcn/ui, routed under `import.meta.env.BASE_URL`.

- `/` — Dashboard: overview, units, KPIs, recent activity.
- `/units/:unitNumber` — Unit's lectures and assignments.
- `/lectures/:lectureId` — Lecture reading view (markdown).
- `/assignments/:assignmentId` — Assignment detail + start.
- `/attempts/:attemptId` — Attempt runner: record/write per prompt, submit, see grade + feedback, finalize.
- `/attempts` — Past attempts.
- `/progress` — Analytics.
- `/diagnostics` — Operator self-tests.

All data flows through generated hooks from `@workspace/api-client-react`; no shape is hand-written on the client.

---

## 6. Configuration & Secrets

Server-side only (never exposed to the browser):

- `DATABASE_URL` — Postgres (Neon).
- `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`).
- `ASSEMBLYAI_API_KEY` — transcription.
- `OPENAI_API_KEY`, `GPTZERO_API_KEY` — used by the shared backend and surfaced in diagnostics.
- Object storage: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`.

---

## 7. Failure Philosophy

Podium is explicit when it fails. Transcription and grading are real network calls to real providers; when they fail, the student sees an error and can retry, the response is marked `failed`, and the API returns a non-200. There are no silent fallbacks that invent a score — a grade in Podium always corresponds to a real evaluation of a real recording.
