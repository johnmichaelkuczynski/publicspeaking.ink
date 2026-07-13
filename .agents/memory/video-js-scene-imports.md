---
name: video-js DESIGN subagent scene import quirk
description: Why first-build video-js scenes can fail to resolve the animations import, and the reliable fix.
---

# video-js scene import path quirk

When the DESIGN subagent builds a video-js video, it puts scene components in
`src/components/video/video_scenes/` and imports the animation presets with a
relative path like `from '../../lib/video/animations'`. From that subfolder the
path is off by one directory level (it resolves to `src/components/lib/...`),
so Vite throws `Failed to resolve import "../../lib/video/animations"` on first
workflow start and the preview is blank.

**Fix:** rewrite those imports to the alias `from '@/lib/video'` (the barrel),
which already re-exports `sceneTransitions` etc. `VideoTemplate.tsx` itself uses
the alias correctly — only the generated scene files in the subfolder get the
relative path wrong.

**Why:** the subagent computes the relative depth as if the scenes lived one
level up. Don't trust its relative `../` paths in nested scene folders.

**How to apply:** after the design subagent returns and before/at the first
`refresh_all_logs`, if you see this resolve error, run a sed across
`video_scenes/Scene*.tsx` swapping the relative animations import for
`@/lib/video`, then restart the workflow.
