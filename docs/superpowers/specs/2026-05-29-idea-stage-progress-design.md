# Idea Stage Progress — Design Spec

**Date:** 2026-05-29
**Feature:** #1 of 3 (Progress → Published/verify → R2→Drive archive). This spec covers **Progress only**.
**Status:** Approved design — pending spec review

## Goal

Make the per-idea pipeline progress **quantitative and visible**: show how far each stage
is (with counts), an overall completion bar, and the same progress as compact chips on the
video cards in `/video-reviews` — so progress is scannable without opening each idea.

## Context (current behavior)

- `app/(dashboard)/produccion/idea/[ideaId]/page.tsx` builds the timeline with **hardcoded**
  stage logic: Idea (`done: true`), Caption (`!!generated_caption`), Material
  (`vids.some(kind==='raw')`), Editado (`vids.some(kind==='edited')`), Assets (`done: false`).
  No counts beyond the slot `n/total` labels inside the panel.
- `components/produccion/pipeline-timeline.tsx` renders `TimelineStage[]` (`id`, `label`,
  `icon`, `done`); highlights active (IntersectionObserver) + green check when `done`.
- `components/video-pipeline/video-card.tsx` (in `/video-reviews`) shows slot summaries but
  no stage chips.
- All needed data already exists — **no migration**: `content_ideas` (`hook`, `visual_brief`,
  `generated_caption`, `approval_status`, `published_at`), `content_idea_videos` (kind/status),
  `client_assets`.

## Key decisions (confirmed)

- Stages: **7** — Idea → Caption → Material → Editado → Assets → Aprobación → Publicado.
- "Done" threshold: **≥1** for Material (raw) and Editado, but **show counts**.
- Surfaces: timeline pills with counts **+** global progress bar with "what's missing" **+**
  stage chips on the `/video-reviews` cards.
- "Publicado" uses only the internal flag (`published_at`); real Metricool verification is a
  separate later feature (#2).

## Architecture

### 1. Pure progress helper — `lib/utils/idea-progress.ts`

Single source of truth. No `server-only`/server imports so it runs in client components,
server components, and tests.

```ts
export type StageKey = 'idea' | 'caption' | 'material' | 'edited' | 'assets' | 'approval' | 'published'

export interface StageProgress {
  key: StageKey
  label: string                 // Spanish UI label
  done: boolean
  count?: { current: number; total: number }   // shown when present
  detail?: string               // e.g. approval sub-state ('En revisión')
}

export interface IdeaProgress {
  stages: StageProgress[]
  completed: number             // # of done stages
  total: number                 // 7
  percent: number               // round(completed/total*100)
  missing: string[]             // labels of incomplete stages (for "Falta: …")
}

export function computeIdeaProgress(input: {
  idea: Pick<ContentIdea, 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'>
  videos: { raw: ContentIdeaVideo[]; broll: ContentIdeaVideo[]; edited: ContentIdeaVideo[] }
  assetCount: number
}): IdeaProgress
```

Stage rules:

| Stage | done when | count |
|---|---|---|
| Idea | `hook?.trim()` && `visual_brief?.trim()` | — |
| Caption | `generated_caption?.trim()` non-empty | — |
| Material | ≥1 **active** raw | raw `n/4`, broll `n/4` (display) |
| Editado | ≥1 **active** edited | edited `n/2` |
| Assets | `assetCount >= 1` | `n` |
| Aprobación | `approval_status === 'approved'` | detail = pending/En revisión/Cambios pedidos |
| Publicado | `published_at != null` | — |

"Active" = video status in `uploading|uploaded|processing` (reuse the existing predicate;
exclude `archived`/`failed`). Counts use min targets (4/4/2) for display but **done is ≥1**.
Stages are evaluated independently (no linear assumption — an out-of-order `published_at`
with an incomplete earlier stage shows the true per-stage state).

### 2. Idea workspace — `produccion/idea/[ideaId]/page.tsx`

- Replace the hardcoded stage array with `computeIdeaProgress(...)`.
- Load the client's `client_assets` count (add to the page's data fetch if not already loaded).
- Pass counts/detail into the timeline.

### 3. Timeline — `components/produccion/pipeline-timeline.tsx`

- Extend `TimelineStage` with optional `count?: {current,total}` and `detail?: string`.
- Render the count (e.g. `1/4`) and/or detail under the label; keep the active-highlight +
  green-check behavior. Add `approval` + `published` icons.

### 4. Global progress bar — `components/produccion/idea-progress-bar.tsx` (new)

- Shows `percent% · completed/total etapas` + a bar, and a line `Falta: <missing joined>`.
- Rendered at the top of the idea workspace.

### 5. Video-card chips — `components/video-pipeline/video-card.tsx`

- Add a compact stage-chip row using the **same** `computeIdeaProgress` helper
  (💡✓ ✍️✓ 🎬1/4 🎞️0/2 🎨n ✅/⏳ 📢), so the grid shows progress at a glance.
- `getClientVideoPipeline` already returns the grouped videos; ensure it also returns the
  client `assetCount` (it already loads `client_assets`).

## Testing

- **Unit (`idea-progress.test.ts`)**: each stage done/not at boundaries; counts; `percent`;
  `missing`; active-only counting; approval sub-states; published flag.
- **Render**: timeline shows counts; video-card renders the chip row.

## Edge cases (handled + tested)

Missing hook/brief; whitespace-only caption; raw present but `archived`/`failed` (not counted);
`approval_status='revision_needed'` (not done, detail shown); `published_at` set with earlier
stages incomplete (per-stage truth, not linear); client with 0 assets; counts above the min
(display shows `n/total` with `n` **un-capped** — e.g. `5/4` — while the overall progress bar
is capped at 100%).

## Out of scope

- Real publish verification against Metricool (feature #2).
- R2→Drive archival (feature #3).
- Any schema change.

## File touch list

- `lib/utils/idea-progress.ts` (new) + test
- `components/produccion/pipeline-timeline.tsx`
- `components/produccion/idea-progress-bar.tsx` (new)
- `app/(dashboard)/produccion/idea/[ideaId]/page.tsx`
- `components/video-pipeline/video-card.tsx`
- `lib/actions/video-pipeline.ts` (return `assetCount` per client)
