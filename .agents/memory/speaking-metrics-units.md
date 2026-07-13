---
name: Speaking metrics units
description: Unit semantics for delivery metrics so the frontend doesn't double-scale them.
---
# Speaking delivery metric units

`fillerRate` produced by the server speech analysis is **already a per-100-words count** (computed as `(fillerCount / wordCount) * 100` and rounded). It is NOT a 0–1 fraction.

**Why:** A Coach/analytics page once multiplied `averageFillerRate` by 100 again to render a "%", showing values like 320% — 100x too high. The metric is consumed/displayed as-is, labelled "fillers per 100 words", not formatted as a percentage.

**How to apply:** When surfacing any speaking delivery metric (fillerRate, wordsPerMinute, pauseCount), display the stored value directly. Don't assume fractions. Check `artifacts/api-server/src/lib/speech.ts` for the exact formula before scaling.
