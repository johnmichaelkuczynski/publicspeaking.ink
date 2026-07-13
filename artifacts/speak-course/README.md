# 🎙️ Podium — Public Speaking Studio

**The Spoken-First Studio — A Four-Week College Public Speaking Course That Teaches, Coaches, and Grades How You Actually Speak**

---

## 🧩 Overview

Podium is a self-paced, single-user web course that delivers a full month of college public speaking — taught, drilled, and graded entirely by AI, with most assignments performed **out loud**.

Instead of typing essays about communication, the student steps up to the mic, records a real spoken answer, and gets coached on both *what* they said and *how* they said it. It compresses a semester-style public speaking class into one focused product: read the lecture, practice against a prompt, record your response, and submit homework, tests, and a capstone speech that are transcribed and evaluated by AI — scored on content **and** delivery, with concrete, actionable feedback on every attempt.

Designed for **college freshmen, self-learners, instructors evaluating AI-coached coursework, and anyone who wants to get measurably better at speaking**, Podium pairs a real public speaking curriculum with automatic transcription and a coaching grader that reads your pacing, filler words, and pauses — not just your words.

---

## 🎤 What It Does

- **Four-Unit Structured Curriculum** — A complete public speaking syllabus across 29 topics: managing nerves, breath and projection, posture and presence, audience analysis, message structure, openings and closings, evidence and storytelling, pace and the pause, vocal variety, eliminating filler words, body language, handling questions, rehearsal technique, persuasion, adapting to the occasion, impromptu speaking, and a full capstone speech. Each unit ships with lectures, homework, and a test.
- **Spoken-First Assignments** — Most homework and every test is delivered out loud. The student records audio (or video) directly in the browser, and on submit the recording is transcribed and graded — no typing required.
- **Two-Dimensional Coaching Grade** — Every spoken response is scored on **content** (structure, clarity, argument, relevance) and **delivery** (pace, fluency, filler words, pauses, vocal energy) *separately*, then blended into an overall score and letter grade — with a written summary, what worked, and what to fix next time.
- **Delivery Metrics Straight From the Audio** — Each recording yields measured signals: words per minute, filler-word count and rate, number and length of pauses, and fluency and pace-variation proxies — so feedback points to evidence, not vibes.
- **Written Reflections Where They Belong** — A few assignments (audience analysis, rehearsal planning) are written short-answer reflections, graded on content alone — because not every speaking skill is a performance.
- **Lecture Reading + Practice Loop** — Read the lecture for any topic, then move straight into the assignment that practices it, so concept and rehearsal stay tied together.
- **Live Progress Analytics** — Per-unit mastery, average content and delivery scores, best score, and a recent-activity feed — so improvement over the month is visible at a glance.
- **Operator Diagnostics** — Two one-click self-tests verify the entire stack — database, OpenAI, the Anthropic grader, AssemblyAI transcription, GPTZero, object storage, and the full record → transcribe → grade loop — before you trust a session.

---

## ⚙️ Technical Features

- **Spoken Submission Pipeline** — The browser records with `MediaRecorder`, requests a presigned upload URL, PUTs the blob to object storage, then submits the object path. The server downloads the recording, transcribes it via **AssemblyAI** (with disfluencies on), derives delivery metrics from word-level timings, and grades content + delivery via **Anthropic** (`claude-sonnet-4-5`, configurable through `ANTHROPIC_MODEL`).
- **Fail-Loud Grading** — If transcription or evaluation fails, the response is stored as `failed` and the API returns **502** — the system never fabricates a grade or a transcript. A failure is surfaced as a failure, never papered over with a silent fallback.
- **Backend-Only Keys** — `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, and every other provider key live only on the server; the browser never sees them.
- **Contract-First API** — A single OpenAPI document is the source of truth; React Query hooks for the UI and Zod validators for the server are generated from it, so request and response shapes can't drift between client and server — both come from the same spec.
- **Two Diagnostic Self-Tests** —
  - **System** (`GET /api/speaking/diagnostics/system`): ordered checks for environment, database round-trip, course-seed integrity, OpenAI completion, the Anthropic grader, AssemblyAI authentication, and GPTZero connectivity. Each step returns pass/fail, timing, and a raw error string.
  - **Synthetic-Student** (`POST /api/speaking/diagnostics/synthetic-run`): starts a fresh attempt on a written reflection prompt, grades it through the real evaluator, finalizes and rolls up the score, verifies analytics reflect the run, then cleans itself up — an end-to-end stack proof in one click.

---

## 🎓 Designed For

- **College Freshmen & Self-Learners:** A complete one-month public speaking course with spoken practice and automatic coaching — no instructor required.
- **Instructors & Curriculum Designers:** A working reference for AI-taught, AI-graded speaking coursework that evaluates *delivery*, not just text.
- **Product & Engineering Teams:** A reference implementation of a record → upload → transcribe → grade pipeline, contract-first full-stack architecture, and self-diagnostic operator tooling in a Replit pnpm monorepo.

---

## 💡 Core Idea

Most "speaking" courses still grade you on what you write. Podium grades you on what you *say* — and on how you say it.

It teaches the material, gives you a prompt, listens to your actual voice, measures your pacing and filler words, and hands back a coach's note you can act on before the next take. The result is a self-paced course where getting better at speaking is something you do out loud, on the record, and can measure week over week.

**Podium — where the lecture, the prompt, the microphone, and the coach all live in one room.**
