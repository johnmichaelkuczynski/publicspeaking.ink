# 🎙️ Podium — Public Speaking Studio

**The Spoken-First Studio — A Four-Week College Public Speaking Course That Teaches, Coaches, and Grades How You Actually Speak**

---

## 🧩 Overview

Podium is a self-paced, single-user web course that delivers a full month of college public speaking — taught, drilled, and graded entirely by AI, with most assignments performed **out loud**. Instead of typing essays about communication, the student steps up to the mic, records a real spoken answer, and gets coached on both *what* they said and *how* they said it.

Read the lecture, practice against a prompt, record your response, and submit homework, tests, and a capstone speech that are transcribed and evaluated by AI — scored on content **and** delivery, with concrete, actionable feedback on every attempt.

---

## 🗂️ Monorepo Layout

This is a pnpm workspace. The deployable artifacts:

| Artifact | Slug | Role |
| --- | --- | --- |
| `@workspace/api-server` | `api-server` | Express API mounted at `/api`. Owns the DB, object storage, AssemblyAI transcription, Anthropic grading, and diagnostics. |
| `@workspace/speak-course` | `speak-course` | Student-facing Podium web app — the actual course. Served at the root (`/`). |
| `@workspace/speak-course-demo` | `speak-course-demo` | Screencast-style product demo video, exported as MP4 from the preview pane. |
| `@workspace/speak-course-marketing` | `speak-course-marketing` | Marketing / promo video for the product. |

Shared contracts and libraries live in `lib/` (OpenAPI spec, generated hooks/validators, etc.). See `artifacts/speak-course/README.md` and `artifacts/speak-course/BLUEPRINT.md` for product and architecture detail.

---

## 🔐 Authentication

- **Direct Google OAuth 2.0** — no third-party auth service. The server (`api-server`) runs the standard authorization-code flow itself using `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` secrets and `google-auth-library`.
- **Session = signed JWT cookie** (`podium_session`, httpOnly, 30 days) signed with `SESSION_SECRET`. No session table, no external session store.
- **Routes:** `/api/auth/google` (redirect to Google), `/api/auth/google/callback` (code exchange + ID-token verification), `/api/auth/me`, `POST /api/auth/logout`.
- **Server-side enforcement:** all `/api` routes require a session except health checks and `/api/auth/*` (401 otherwise).
- **Google Cloud Console requirement:** the OAuth client must list each environment's callback as an authorized redirect URI: `https://<domain>/api/auth/google/callback`.
- **Access control:** `ALLOWED_EMAILS` (comma-separated) restricts who may sign in; other Google accounts get `/?auth=unauthorized`. If unset, any Google account can sign in (a warning is logged on every sign-in).
- **Single-user data model unchanged:** login gates access, but course progress is still one shared store (no per-user scoping).

## ⚙️ Key Technical Notes

- **Spoken submission pipeline:** browser records with `MediaRecorder` → presigned upload URL → PUT to object storage → submit object path. Server transcribes via **AssemblyAI**, derives delivery metrics, and grades content + delivery via **Anthropic** (`claude-sonnet-4-5`, configurable via `ANTHROPIC_MODEL`).
- **Fail-loud grading:** if transcription or evaluation fails, the response is stored as `failed` and the API returns **502** — never a fabricated grade.
- **GPTZero is diagnostics-only** here (a connectivity check), not a per-submission detector — this is an intentional, documented scope decision, not a gap.
- **Contract-first API:** one OpenAPI document is the source of truth; React Query hooks and Zod validators are generated from it.
- **Backend-only keys:** all provider keys live on the server; the browser never sees them.

---

## 👤 User Preferences

- Caps in requests are for emphasis, not literal instructions.
- **Auth must be direct Google OAuth with the user's own credentials** — never Clerk, never Replit-based login, never test/placeholder credentials.
- Keep documentation polished and in the emoji-section-header style used in this README.
