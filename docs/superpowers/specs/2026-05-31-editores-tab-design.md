# Editores Tab (Video QC) — Design Spec

**Date:** 2026-05-31
**Status:** Approved design — pending spec review

## Goal

Add an **"Editores"** tab to Video QC (`/video-reviews`) showing the editing queue: videos whose
raw footage is already uploaded but have no edited video yet. Each card lets the editor
download/preview the source material (crudos + b-roll) and upload the edited video — inline.

## Context (existing)

- `app/(dashboard)/video-reviews/page.tsx` is a server component that loads
  `getClientVideoPipeline()` into `pipeline` and renders two tabs ("Pipeline de videos",
  "Tablero de revisiones") with `@/components/ui/tabs`.
- `getClientVideoPipeline()` → `ClientVideoPipeline[]`; each has `client` + `videos: PipelineVideo[]`
  (each `PipelineVideo` = `ContentIdea` + `videos: { raw, broll, edited }` of `ContentIdeaVideo`).
- R2 actions (`lib/actions/idea-videos-r2.ts`): `getR2DownloadUrl`, `getR2PreviewUrl`,
  `getR2UploadUrl`, `registerR2Video` (all gated `video.upload` server-side).
- RBAC: both `editor` and `video` roles have `video.upload`. `currentUserHas` / `RoleGate` /
  `useHasPermission` available.
- Active video statuses: `uploading|uploaded|processing` (exclude `archived|failed`).

## Key decisions (confirmed)

- Queue = videos with **≥1 active raw AND 0 active edited** (excludes `descartada`). Leaves the
  list when an edited video is uploaded.
- **Inline**: download crudos + b-roll, upload edited, in the same card.
- Material shown: **crudos + b-roll**.
- Gate: **`video.upload`** (editor + video roles).
- No migration, no data change; reuse the already-loaded `pipeline`.

## Architecture

### 1. Page — `app/(dashboard)/video-reviews/page.tsx`

- Compute `const canEdit = await currentUserHas('video.upload')`.
- Flatten the queue from the loaded pipeline:
  `const editQueue = pipeline.flatMap(p => p.videos.filter(isReadyToEdit).map(v => ({ video: v, client: p.client })))`
  where `isReadyToEdit(v) = v.status !== 'descartada' && activeLen(v.videos.raw) >= 1 && activeLen(v.videos.edited) === 0`.
- When `canEdit`, render a third `<TabsTrigger value="editores">Editores</TabsTrigger>` (with a
  count badge) + `<TabsContent value="editores"><EditoresTab items={editQueue} /></TabsContent>`.
  When not, render neither.

### 2. `components/video-pipeline/editores-tab.tsx` (new, client)

Props: `{ items: EditQueueItem[] }` where
`EditQueueItem = { video: PipelineVideo; client: Pick<Client,'id'|'name'|'logo_url'> }`.
Renders a responsive grid of `<EditorVideoCard>`; empty state ("Nada por editar 🎉 — sube los
crudos primero o ya todo está editado").

### 3. `components/video-pipeline/editor-video-card.tsx` (new, client)

Per video:
- **Header:** `ClientLogo` + client name + video title (link to `/produccion/idea/[id]`) + type badge
  + truncated caption (reference).
- **"Material a editar":** a list of active `raw` + `broll` videos. Each row: kind icon + name +
  **Ver** (preview via `getR2PreviewUrl` → inline `<video>` toggle) + **Bajar** (download via
  `getR2DownloadUrl`). Read-only (no upload/delete here). For Drive-stored videos, **Bajar** uses
  `drive_view_link`.
- **"Subir editado":** a dropzone (drag/drop + click, `multiple`) that uploads via
  `getR2UploadUrl({ kind:'edited' })` → XHR PUT → `registerR2Video({ kind:'edited' })`, with batch
  progress (mirrors the panel's uploader). On success, toast + `router.refresh()` (the video then
  drops from the queue).

A small `useEditedUpload(ideaId)` helper inside the file encapsulates the R2 upload (presign → PUT
→ register) to keep the component readable.

## Testing

- **`editor-video-card`**: lists active crudos + b-roll with a **Bajar** control each; renders the
  "Subir editado" dropzone (input `accept="video/*" multiple`); shows the caption; title links to
  the workspace.
- **`editores-tab`**: renders one card per item; empty state when `items=[]`.
- (The filter `isReadyToEdit` is unit-tested via a small exported helper.)

## Edge cases (handled + tested)

No b-roll (only crudos shown) · multiple raws · uploading an edited video removes the item on
refresh · `descartada` excluded · oversize/invalid upload (toast, 5 GB cap like the panel) ·
no `video.upload` → tab not rendered.

## Out of scope

- Changing `getClientVideoPipeline` or the other tabs.
- Assigning videos to specific editors (the queue is shared).
- Migrations.

## File touch list

- `app/(dashboard)/video-reviews/page.tsx` (gate + 3rd tab + flatten queue)
- `components/video-pipeline/editores-tab.tsx` (new) + test
- `components/video-pipeline/editor-video-card.tsx` (new) + test
- `lib/utils/edit-queue.ts` (new: `isReadyToEdit` + `activeLen` helpers) + test
