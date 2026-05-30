# Planning 2-Week Plan — Per-Row Status Column — Design Spec

**Date:** 2026-05-29
**Status:** Approved design — pending spec review

## Goal

In the Planning "Plan 2 sem" table (`DÍA | TIPO | IDEA DEL VIDEO | CAPTION`), add a **STATUS**
column that shows, for each slot linked to an idea, where that video is in the pipeline
(7-segment status bar). Empty slots keep "Falta video" with no bar.

## Context (existing)

- `components/planning/client-schedule.tsx` renders the 2-week table. Row type `ScheduleTask`:
  `{ publishDate, ideaId, ideaTitle, contentType, hasCaption }`. When `ideaId` is null the row
  shows "Falta video".
- `app/(dashboard)/planning/page.tsx` builds `ScheduleTask`s: queries `production_tasks`
  (`client_id, publish_date, idea_id, content_type`) and `content_ideas` (`id, title,
  generated_caption`) by id. `production_tasks.idea_id → content_ideas.id`.
- Reusable (on main): `computeIdeaPipeline({ idea, videos, recordingScheduled })` →
  `IdeaPipeline` (7 stages) in `lib/utils/idea-pipeline-stages.ts`; `IdeaStatusBar`
  (`components/ideas/idea-status-bar.tsx`, segmented bar).

## Key decisions (confirmed)

- Per-row **STATUS** column (not an overall summary — the client chips already exist).
- Empty slots: keep "Falta video", **no bar**.
- Derive recorded/edited stages from the idea's `status` (no N+1 to `content_idea_videos`);
  scheduled from `recording_session_id`. `videos: []` is passed to `computeIdeaPipeline`.
- **No migration**.

## Architecture

### 1. Data — `app/(dashboard)/planning/page.tsx`

Extend the `content_ideas` select from `id, title, generated_caption` to also fetch:
`hook, visual_brief, status, approval_status, published_at, recording_session_id, recording_date`.
When building each `ScheduleTask`, attach an `idea` object with those fields (null when no idea).

### 2. Type — `components/planning/client-schedule.tsx`

```ts
import type { ContentIdea } from '@/lib/supabase/types'

export type ScheduleIdeaFields = Pick<
  ContentIdea,
  'hook' | 'visual_brief' | 'generated_caption' | 'status'
  | 'approval_status' | 'published_at' | 'recording_session_id' | 'recording_date'
>

export interface ScheduleTask {
  publishDate: string
  ideaId: string | null
  ideaTitle: string | null
  contentType: string | null
  hasCaption: boolean
  idea: ScheduleIdeaFields | null   // new: pipeline fields for the linked idea
}
```

### 3. UI — `components/planning/client-schedule.tsx`

- Add a **STATUS** column header (after "IDEA DEL VIDEO", before "CAPTION", or at the end).
- Per row: if `t?.ideaId && t.idea`, render
  `<IdeaStatusBar pipeline={computeIdeaPipeline({ idea: t.idea, videos: [], recordingScheduled: false })} />`
  (the helper marks "Agendada" done via `idea.recording_session_id`). Else render a muted "—".
- Keep the existing "Falta video" text in the IDEA DEL VIDEO column for empty slots.

## Testing

- Render test for `ClientSchedule`: a row with a linked idea shows the status bar (segments +
  current-stage label); an empty row shows no bar and keeps "Falta video". (`computeIdeaPipeline`
  + `IdeaStatusBar` are already unit/render-tested.)

## Edge cases (handled)

Slot with no idea (no bar) · idea with only some fields (helper handles nulls) · published idea
(bar full) · column stays readable on narrow widths (responsive, status bar `min-w-0`).

## Out of scope

- Overall client-level status summary (the chips already cover it).
- Loading per-idea `content_idea_videos` (status field is the canonical pipeline state here).
- Migrations.

## File touch list

- `app/(dashboard)/planning/page.tsx` (extend the idea select + attach `idea` to each slot)
- `components/planning/client-schedule.tsx` (type + STATUS column) + test
