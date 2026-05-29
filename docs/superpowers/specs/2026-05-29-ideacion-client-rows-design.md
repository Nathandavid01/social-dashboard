# Ideación — Client Rows with Per-Video Status Bar — Design Spec

**Date:** 2026-05-29
**Status:** Approved design — pending spec review

## Goal

Restructure **Ideación** so clients appear as **rows**. Inside each client, list its videos
(ideas), each showing both dates (recording + publish) and a **segmented status bar** of where
it is in the production pipeline: Idea → Caption → Agendada → Grabación → Edición → Aprobación
→ Publicado.

## Context (existing)

- `app/(dashboard)/ideacion/page.tsx` loads `getContentIdeas({ limit: 200 })` (joins `client`,
  `production_task`) + active clients + profiles, and renders `IdeacionBoard`
  (`components/ideas/ideacion-board.tsx`) as a **3-column card grid** with header stats
  (`N ideas · pendientes · en flujo · publicadas`), client + status filters, and "Generar ideas".
- `content_ideas` fields: `hook`, `visual_brief`, `generated_caption`, `status`
  (`idea|asignada|grabada|producida|publicada|descartada`), `approval_status`, `published_at`,
  `recording_date`, `publish_date`, `recording_session_id`, `production_task_id`.
- `recording_sessions` (migration 0004): `id`, `session_date`, `client_id`, `status`
  (`scheduled|completed|cancelled`). `content_ideas.recording_session_id` FK → it ("agendada").
- `content_idea_videos`: `kind` (`raw|broll|edited`), `status` (active = `uploading|uploaded|processing`).
- Reusable: `getClientVideoPipeline` grouping pattern; `ClientLogo`; `computeIdeaProgress`
  (different 7-stage "completeness" model — left untouched).

## Key decisions (confirmed)

- **Replace** the card grid with client rows (keep header stats, filters, "Generar ideas").
- **7 ordered stages:** Idea → Caption → Agendada → Grabación → Edición → Aprobación → Publicado.
- Show **both** dates (recording + publish) per video.
- Status indicator = **segmented bar**.
- **No migration** — all derived from existing data.

## Architecture

### 1. Stage helper — `lib/utils/idea-pipeline-stages.ts` (new, pure)

```ts
export type PipelineStageKey =
  | 'idea' | 'caption' | 'scheduled' | 'recorded' | 'edited' | 'approval' | 'published'

export interface PipelineStage { key: PipelineStageKey; label: string; done: boolean }

export interface IdeaPipeline {
  stages: PipelineStage[]          // 7, in order
  currentIndex: number             // first not-done index (or stages.length if all done)
  completed: number
  percent: number                  // round(completed/7*100)
}

export function computeIdeaPipeline(input: {
  idea: Pick<ContentIdea, 'hook' | 'visual_brief' | 'generated_caption' | 'status'
    | 'approval_status' | 'published_at' | 'recording_session_id' | 'recording_date'>
  videos: ContentIdeaVideo[]
  recordingScheduled: boolean      // session linked + status scheduled|completed
}): IdeaPipeline
```

Stage "done" rules (independent, no linear assumption):

| key | label | done when |
|---|---|---|
| idea | Idea | `hook?.trim()` && `visual_brief?.trim()` |
| caption | Caption | `generated_caption?.trim()` |
| scheduled | Agendada | `recordingScheduled === true` (or `recording_session_id` present) |
| recorded | Grabación | `status === 'grabada'` OR `recording_date != null` OR ≥1 active raw |
| edited | Edición | ≥1 active edited OR `status === 'producida'` |
| approval | Aprobación | `approval_status === 'approved'` |
| published | Publicado | `published_at != null` OR `status === 'publicada'` |

`currentIndex` = index of first `!done` (for highlighting "where it is").

### 2. Data — `getIdeacionPipeline()` in `lib/actions/content-ideas.ts` (new)

Returns clients (rows) with their ideas. Per idea: the stage fields above + joined
`recording_session:recording_sessions(status)` (new join) + grouped `videos:content_idea_videos(*)`
(for recorded/edited signals) + `recording_date`, `publish_date`. Mirrors `getClientVideoPipeline`'s
batched 3-query + Map grouping. Accepts the same filters (clientId, status/"open").

```ts
export interface IdeacionRowClient {
  client: Pick<Client, 'id' | 'name' | 'industry' | 'logo_url' | 'platforms'>
  ideas: IdeacionRowVideo[]
}
export interface IdeacionRowVideo extends ContentIdea {
  recordingScheduled: boolean
  videos: ContentIdeaVideo[]
}
export async function getIdeacionPipeline(filter?: { clientId?: string; status?: string }): Promise<IdeacionRowClient[]>
```

### 3. UI

- **`components/ideas/idea-status-bar.tsx`** (new): a 7-segment horizontal bar. Each segment is
  green when its stage is `done`, the **current** stage (first not-done) is highlighted (ring/pulse),
  later stages muted. Segment has a title tooltip with the stage label; a compact legend/label row
  shows the current stage name (e.g. "En Grabación"). Pure presentational — takes an `IdeaPipeline`.
- **`components/ideas/client-ideas-rows.tsx`** (new, client component): renders clients as rows
  (collapsible, default expanded), each with a header (`ClientLogo` + name + count) and inside a
  **row per video**: title + type badge (R/P/C/S) + both dates (🎥 grabación · 📅 publicación) +
  `<IdeaStatusBar>` + quick actions (link to `/produccion/idea/[id]` "Workspace", "Asignar a
  producción" when applicable). Empty state per client with no ideas.
- **`ideacion-board.tsx`**: replace the 3-column grid body with `<ClientIdeasRows>`; keep the
  header stats, the client/status filters, and "Generar ideas". The board receives the
  **grouped** `IdeacionRowClient[]`, applies the client + status filters **client-side**
  (drop ideas failing the status filter; drop clients left with no matching ideas unless a
  specific client is selected), and passes the filtered groups to `ClientIdeasRows`.

### 4. Data flow

`ideacion/page.tsx` calls `getIdeacionPipeline()` (replacing/alongside `getContentIdeas`) and
passes grouped clients to `IdeacionBoard`, which applies client/status filters and renders
`ClientIdeasRows`. Stats are computed from the flattened ideas (unchanged meaning).

## Testing

- **Unit (`idea-pipeline-stages.test.ts`)**: each stage done/not at boundaries; `scheduled` with/
  without session; `recorded` via status/recording_date/raw; `edited` via edited/producida;
  `currentIndex`; `percent`; out-of-order (published but earlier incomplete).
- **Render**: `IdeaStatusBar` fills the right segments + marks current; `ClientIdeasRows` groups by
  client, shows both dates, renders a status bar per video, and an empty state for a client with
  no ideas.

## Edge cases (handled + tested)

Idea with no session (Agendada not done) · `grabada` with no raw uploaded (status wins) ·
out-of-order published · client with zero ideas (empty row) · descartada ideas filtered like today ·
missing dates (show "—").

## Out of scope

- Changing `computeIdeaProgress` or the /video-reviews tab.
- Editing the pipeline from the bar (read-only status; actions stay as links/buttons).
- Migrations.

## File touch list

- `lib/utils/idea-pipeline-stages.ts` (new) + test
- `lib/actions/content-ideas.ts` (add `getIdeacionPipeline`)
- `components/ideas/idea-status-bar.tsx` (new) + test
- `components/ideas/client-ideas-rows.tsx` (new) + test
- `components/ideas/ideacion-board.tsx` (swap grid → rows; keep header/filters)
- `app/(dashboard)/ideacion/page.tsx` (load `getIdeacionPipeline`)
