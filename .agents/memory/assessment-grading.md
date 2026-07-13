---
name: Assessment grading parity
description: Spoken/written ASSESSMENTS must grade like ASSIGNMENTS — the two flows diverged and assessments silently gave no feedback.
---

# Assessment grading must mirror assignment grading

Podium has two graded flows: **assignments** (AttemptRunner + evaluateResponse) and
**assessments** (AssessmentRunner + speakingAssessments route). They are separate
code paths and drifted: the assessment "complete" path only stored answers and
never called `evaluateResponse`, so finishing an assessment produced ZERO feedback.

**Rule:** any "the student submits a speech and gets graded" surface must run
`evaluateResponse` per question and persist the result. Assessments store it in a
`feedback` jsonb column on `speaking_assessments`.

**Why:** product promise is "EVERY speech gets thorough feedback, no matter what."
A completion-credit-only path violates that and the user will (rightly) be furious.

**How to apply:**
- Grade spoken answers on content AND delivery only when measured delivery metrics
  are present; otherwise grade `mode:"written"` content-only. Passing spoken mode
  with no metrics makes `evaluateResponse` default deliveryScore to 0 — a false
  failing grade. The transcribe endpoint returns metrics for free; thread them
  through complete().
- Fail-loud: grading failure → 502, assessment stays `in_progress`. Persist answers
  BEFORE grading so "your work is saved" is literally true on failure.
- Keep a backfill `POST /speaking/assessments/:id/grade` (content-only) to rescue
  already-completed assessments that predate grading.
- Client metrics are kept in a ref keyed by question index: reset it when the
  assessment id/data changes, attach only after a non-empty transcript, and drop it
  on re-record/reset — otherwise stale delivery metrics grade the wrong answer.
