---
name: Storage readiness
description: Storage authorization can fail independently of account login and configured environment variables.
---

Treat storage readiness as an actual signed upload and byte-for-byte read-back, not the presence of storage environment variables.

**Why:** Production rejected upload signing with 401 even though storage settings existed. The previous configuration-only diagnostic missed the failure. The storage setup tool reported no provisioned bucket for this project.

**How to apply:** Inspect published signing failures separately from app login. Use the managed storage setup rather than changing the GCS credential client or adding user authentication. Verify preview and published behavior independently; a working preview does not prove the running deployment has picked up repaired storage configuration. Preserve any existing recordings when changing storage paths.