# Client Video Pipeline — Design Spec

**Date:** 2026-05-28
**Branch:** `feat/content-pipeline` (worktree `client-crm-profile`)
**Status:** Approved design — pending spec review

## Goal

Give each client profile a per-video pipeline. Each "video" is a `content_idea`. For every
video, surface: client-level shared assets, an approval status, the idea brief, captions,
upload slots (≥4 raw clips), b-roll slots (≥4), edited-video slots (≥2), an approval button,
and recording/publish dates. The grid of video cards lives in `/video-reviews`.

## Context / Existing Foundation

The worktree already has ~70% of this built with an **idea-centric** architecture:

- **Client profile** at `/clients/[id]` with tabs (overview, brand, contract, billing, assets,
  tasks, content).
- **`content_ideas`** table = the "idea/video" unit. Has `generated_caption`,
  `caption_platform`, `caption_generated_at`, `status`
  (`idea|asignada|grabada|producida|publicada|descartada`).
- **`content_idea_videos`** table = per-idea uploaded files, `kind` ∈ `raw|broll|edited`,
  `storage_provider` (`drive|r2|supabase`), `drive_file_id` holds the R2 object key when
  `storage_provider='r2'`, plus `status` (`uploading|uploaded|processing|failed|archived`).
- **R2 integration** in `lib/integrations/r2.ts` + `lib/actions/idea-videos-r2.ts`:
  `getR2UploadUrl`, `registerR2Video`, `getR2DownloadUrl`, `deleteR2Video`. Direct browser
  upload via presigned PUT, presigned GET for download. Key scheme:
  `ideas/{ideaId}/{kind}/{timestamp}-{slug}`. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (`nmedia-videos`).
- **Idea workspace** at `/produccion/idea/[ideaId]` with `IdeaVideoPanel` (`components/recording/idea-video-panel.tsx`):
  currently **1 raw slot + N b-roll slots + 1 edited slot**. `IdeaCaptionEditor`,
  `ClientAssetsDownload`, pipeline timeline.
- **`client_assets`** (brand kit): `kind` ∈ `logo|color_guide|font|legal|contract|other`.
- **`video_reviews`** board at `/video-reviews` — separate approval board, NOT connected to ideas.

## Key Decisions (confirmed with user)

1. Build on the **idea pipeline** (not a new `videos` table, not `video_reviews`).
2. Approval lives **on the idea** (status + approver + dates), not via `video_reviews`.
3. Video-card grid lives in **`/video-reviews`** as a new tab alongside the existing board.
4. Slot counts are a **minimum** (4 raw / 4 broll / 2 edited), with "add more" allowed.
5. Shared assets stay **client-level** (`client_assets`), shown read-only on each card.

## Architecture

### 1. Data model — migration `0025_idea_approval_dates.sql`

Add to `content_ideas`:

| Column | Type | Notes |
|---|---|---|
| `approval_status` | text | `pending \| submitted \| approved \| revision_needed`, default `pending`, CHECK constraint |
| `approved_by` | uuid | FK → `profiles(id)`, nullable |
| `approved_at` | timestamptz | nullable |
| `submitted_at` | timestamptz | nullable |
| `recording_date` | date | nullable |
| `publish_date` | date | nullable |

`content_idea_videos` schema is **unchanged**. Behavior change (code only): `registerR2Video`
stops archiving the previous `raw`/`edited` video — all three kinds now **accumulate** (as
b-roll already does). Deletion remains available via `deleteR2Video` (sets `status='archived'`).

RLS: follow the existing `content_ideas` policy pattern (authenticated read/write; the approval
columns are written only through the gated server actions below).

### 2. Types — `lib/supabase/types.ts`

Extend the `ContentIdea` type with the six new fields. Add an `IdeaApprovalStatus` union type.
Verify no other consumer of `ContentIdea` breaks (`npm run build` is authoritative).

### 3. R2 / slots — `components/recording/idea-video-panel.tsx`

- Render **min 4 raw + 4 b-roll + 2 edited** slots; empty slots visible and uploadable.
- "Agregar más" button per group to add slots beyond the minimum.
- Reuse `getR2UploadUrl / registerR2Video / getR2DownloadUrl / deleteR2Video` unchanged
  (except the archive-removal behavior change in `registerR2Video`).
- Keep existing upload progress UI, drag-drop, permission gate (`video.upload`).

### 4. Approval — `lib/actions/idea-approval.ts` + `components/produccion/approval-button.tsx`

Server actions (role-gated: owner or `video.approve`):

- `submitIdeaForApproval(ideaId)` → `approval_status='submitted'`, `submitted_at=now()`.
- `approveIdea(ideaId)` → `approval_status='approved'`, `approved_by=user`, `approved_at=now()`.
- `requestRevision(ideaId, notes?)` → `approval_status='revision_needed'`.

Valid transitions: `pending→submitted`, `submitted→approved`, `submitted→revision_needed`,
`revision_needed→submitted`. Invalid transitions are rejected with an error (and tested).

`approval-button.tsx` renders the correct action(s) based on the current user's role and the
idea's `approval_status`; shows a disabled/explanatory state when the user can't act.

### 5. UI — `/video-reviews` with tabs

`app/(dashboard)/video-reviews/page.tsx` gains two tabs (using existing `Tabs` primitive):

- **"Pipeline de videos"** (new): list of clients; per client a compact profile header
  (reuse/condense `client-hero`), a shared-assets strip (read-only `client_assets`), and a
  **grid of video cards** — one per `content_idea` for that client.
- **"Tablero de revisiones"** (existing): the current `VideoReviewBoard`, untouched.

New components under `components/video-pipeline/`:

- `client-video-section.tsx` — per-client header + assets strip + card grid.
- `video-card.tsx` — title + status badge + approval badge · idea (hook/brief) · caption
  preview · slot summary (raw n/4, b-roll n/4, edited n/2 with thumbnail + download) ·
  recording/publish dates · `approval-button`. Click → `/produccion/idea/[ideaId]`.

Data loading: a server action `getClientVideoPipeline()` in `lib/actions/video-pipeline.ts`,
returning clients with their ideas + joined `content_idea_videos` counts/thumbnails +
`client_assets`.

### 6. Tests — Vitest + React Testing Library (new setup)

Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, a
`vitest.config.ts` (jsdom env, path aliases matching `tsconfig`), a test setup file, and a
`"test"` script. Then:

- **`video-card` render:** all slots full / partial (2 of 4) / empty; no caption; no dates;
  client with no ideas (empty state).
- **Slot logic:** correct count and classification per `kind` (≥4/≥4/≥2); "add more" appends.
- **Approval button:** correct actions/disabled state per role × `approval_status`.
- **Approval actions:** valid transitions succeed; invalid transitions rejected; role gate.
- **R2 register behavior:** raw/edited accumulate (no longer archive previous).

### 7. Edge cases (handled + tested)

Empty and partial slots · missing idea fields (hook/brief) · no caption · null dates · client
with zero ideas · upload failure / invalid type / oversize · deleting a slot · approving
without permission or from an invalid status · adding slots beyond the 4/4/2 minimum.

## Out of Scope

- Migrating the legacy `video_reviews` board into the idea pipeline (kept as a separate tab).
- Per-video caption overrides (caption stays idea-level).
- Per-video asset attachment (assets stay client-level, shown read-only).

## File Touch List

- `supabase/migrations/0025_idea_approval_dates.sql` (new)
- `lib/supabase/types.ts`
- `lib/integrations/r2.ts` (no change expected) / `lib/actions/idea-videos-r2.ts` (accumulate)
- `lib/actions/idea-approval.ts` (new)
- `lib/actions/video-pipeline.ts` — new `getClientVideoPipeline`
- `components/recording/idea-video-panel.tsx`
- `components/produccion/approval-button.tsx` (new)
- `components/video-pipeline/client-video-section.tsx` (new)
- `components/video-pipeline/video-card.tsx` (new)
- `app/(dashboard)/video-reviews/page.tsx`
- `vitest.config.ts`, test setup, `package.json` scripts/deps (new)
- Test files alongside the above
