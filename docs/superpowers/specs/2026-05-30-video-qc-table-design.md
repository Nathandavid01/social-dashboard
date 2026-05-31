# Video QC — Client Pipeline as a Clean Data Table — Design Spec

**Date:** 2026-05-30
**Status:** Approved design — pending spec review

## Goal

Replace the 3-column **card grid** in the Video QC "Pipeline de videos" view with a polished,
professional **data table** (Linear/Vercel-style) — one row per video, grouped by client. The
existing client header (logo, name, industry, platforms, count, shared-assets strip) stays.

## Context (existing)

- `components/video-pipeline/client-video-section.tsx`: renders a client `<section>` with a
  polished header, then a `grid sm:grid-cols-2 xl:grid-cols-3` of `<VideoCard>`s.
- `components/video-pipeline/video-card.tsx`: per-video card — type/status/approval badges,
  7-stage chips (`computeIdeaProgress`), brief, caption preview, slot summary
  (crudos/broll/editados counts), recording/publish dates, and an `<ApprovalButton>`
  ("Enviar a revisión" / "Aprobar"). Used only here.
- Data: `getClientVideoPipeline()` → clients with `videos: PipelineVideo[]` (each is a
  `ContentIdea` + `videos: {raw,broll,edited}` slots) + `assets`.
- Reusable: `computeIdeaProgress({ idea, videos, assetCount })` → 7 stages + percent;
  `ApprovalButton`; `ClientLogo`; `cn`.

## Key decisions (confirmed)

- Layout: **clean data table** (Linear/Vercel), one row per video, grouped by client.
- Caption shown as a **truncated subtitle** under the title.
- No migration, no data change.

## Architecture

### 1. `components/video-pipeline/video-pipeline-table.tsx` (new)

Renders a responsive `<table>` for one client's videos:
- A muted, uppercase, small column header row: `VIDEO · ESTADO · PROGRESO · MATERIAL · FECHAS`
  + a trailing actions column (no header).
- `<tbody className="divide-y">` of `<VideoPipelineRow>` per video.
- Wrapped in `overflow-x-auto`; on `<sm` the rows collapse to a stacked compact card (CSS via
  responsive classes on the row — see below). Empty state handled by the caller (section).

Props: `{ videos: PipelineVideo[]; assetCount: number }`.

### 2. `components/video-pipeline/video-pipeline-row.tsx` (new)

One `<tr>` per video. `'use client'`. Computes
`const progress = computeIdeaProgress({ idea: video, videos: [...raw,...broll,...edited], assetCount })`.

Columns:
- **VIDEO:** type icon (R/P/C/S) + title (link to `/produccion/idea/[id]`, truncate) + caption
  subtitle (truncated `generated_caption` or muted "Sin caption").
- **ESTADO:** a status pill (`content_idea.status`) + an approval pill (`approval_status`),
  small, soft-tone.
- **PROGRESO:** a compact 7-segment bar (green = done stage; current stage highlighted) + the
  current stage label + `percent%` (from `progress`). A small inline `<StageMeter>` helper.
- **MATERIAL:** `crudos n/4 · broll n/4 · edit n/2` with tiny icons, `tabular-nums`
  (active counts from `progress`/slots).
- **FECHAS:** `🎥 <recording_date|—>` over `📅 <publish_date|—>` (date-only parsed local).
- **ACCIÓN (right):** `<ApprovalButton ideaId approvalStatus />`.

Interaction: the row is clickable → workspace via an overlay `<Link>` (absolute, `z-0`) so the
action button (`z-10`) doesn't nest inside an anchor. Hover highlights the row (`hover:bg-muted/40`).
Discarded (`status==='descartada'`) rows are dimmed.

### 3. `components/video-pipeline/client-video-section.tsx` (modify)

- Keep the header + shared-assets strip + empty state unchanged.
- Replace the `grid ...` block with `<VideoPipelineTable videos={videos} assetCount={assets.length} />`.

### 4. Removal

Delete `components/video-pipeline/video-card.tsx` and `video-card.test.tsx` (replaced; used only
by this section).

## Professional polish (Linear/Vercel cues)

Uppercase muted column headers (`text-[10px] tracking-wide`); `divide-y` body; subtle row hover;
`tabular-nums` for all counts; soft status pills (bg-*/15, border-*/30); right-aligned action;
compact comfortable padding; responsive (table scrolls / row stacks on mobile); existing
dark gold/black theme tokens (`bg-card`, `border`, `text-muted-foreground`).

## Testing

- **`video-pipeline-row`**: renders title link (`/produccion/idea/[id]`), status + approval
  pills, the 7 progress segments, material counts (`0/4` etc.), both dates, and the approval
  button (mock `ApprovalButton` + actions). Truncated caption present / "Sin caption" fallback.
- **`video-pipeline-table`**: renders one row per video + the column headers.

## Edge cases (handled + tested)

Long title/caption (truncate) · no caption ("Sin caption") · null dates ("—") · discarded video
(dimmed) · responsive collapse · empty client (section empty state, unchanged).

## Out of scope

- Changing `getClientVideoPipeline` / `computeIdeaProgress`.
- The Ideación rows or Planning views (separate).
- Migrations.

## File touch list

- `components/video-pipeline/video-pipeline-table.tsx` (new) + test
- `components/video-pipeline/video-pipeline-row.tsx` (new) + test
- `components/video-pipeline/client-video-section.tsx` (swap grid → table)
- `components/video-pipeline/video-card.tsx` + `video-card.test.tsx` (delete)
