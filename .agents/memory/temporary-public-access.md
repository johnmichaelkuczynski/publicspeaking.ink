---
name: Temporary public access
description: Why Podium currently has no user authentication and which session-like behavior must remain.
---

Podium currently has no user login or authentication gate. Every course, diagnostic, administrative, recording, grading, and database-backed feature must remain available without an account until a new login system is explicitly requested.

**Why:** The user explicitly removed the Google login as a temporary measure but required all non-login functionality and data coherence to remain unchanged.

**How to apply:** Do not reintroduce authentication implicitly. Preserve the per-browser studio session used for object-storage ownership because it supports recordings and is not a user login. Retain historical login records and analytics unless the user separately asks to delete them.