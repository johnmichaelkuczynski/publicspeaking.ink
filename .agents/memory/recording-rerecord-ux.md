---
name: Re-record must always be available
description: Convention for the shared AudioRecorder and any spoken-submission flow — re-recording can never be trapped by busy/error state.
---

# Re-record must always be available

The shared `AudioRecorder` exposes a clearly **labeled** "Record again" action in
the recorded state. It must **never** be gated on the `disabled`/busy prop, and it
fires an optional `onReset` callback so parents can cancel in-flight work.

**Why:** The user was furious that after a spoken assessment answer they could not
re-record. The earlier UI used a tiny, unlabeled icon for reset and locked the whole
recorder while transcription ran — so a slow/failed/hung transcription left the user
permanently stuck with no obvious way out. Requirement (verbatim intent): ALWAYS make
re-recording possible, for app error or any reason.

**How to apply:**
- Any spoken-submission screen that consumes `AudioRecorder` should pass `onReset` to
  clear its own staged blob / cancel async work (upload, transcription).
- Use a per-item **take token** (a `useRef<Record<index, number>>` bumped on each new
  recording AND on reset) and guard every async write (`setAnswers`, toasts, clearing
  the busy spinner) behind an `isCurrent()` token check. This stops a stale in-flight
  transcription from overwriting a newer take or re-locking the UI.
- Do not disable the recorder controls while transcription is in flight; rely on the
  token guard for correctness instead of locking the user out.
- Treat an empty transcript as a fail-loud, actionable case ("we couldn't hear
  anything — record again"), not a silent empty answer.
