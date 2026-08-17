-- 0065 — Ownership for in-flight multipart (resilient) uploads
--
-- complete/abort take only { provider, key, uploadId } — anyone with
-- video.upload (shared by owner/supervisor/editor/video roles) who learns
-- those two values could otherwise complete or abort someone else's upload.
-- This table is the ownership record; RLS (not application code) is the
-- actual gate — a row is only visible/deletable by the user who created it,
-- so a stranger's uploadId simply doesn't resolve, same as "not found".
--
-- Rows are removed by the app right after complete/abort succeeds. Anything
-- left behind (tab closed mid-upload) is an abandoned multipart — see the
-- operational note in CHANGELOG v3.47 for the R2 lifecycle rule that reaps
-- the underlying multipart parts; a future cron can join against this table
-- to also clear stale ownership rows.

create table if not exists public.multipart_uploads (
  upload_id   text primary key,
  key         text not null,
  idea_id     uuid not null references public.content_ideas(id) on delete cascade,
  provider    text not null check (provider in ('r2', 'entregas-r2')),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists multipart_uploads_idea_idx
  on public.multipart_uploads (idea_id);

create index if not exists multipart_uploads_created_idx
  on public.multipart_uploads (created_at);

comment on table public.multipart_uploads is
  'Ownership record for in-flight S3/R2 multipart uploads. RLS restricts every row to its creator — complete/abort actions rely on that, not a manual created_by check, so a foreign uploadId resolves to "not found".';

alter table public.multipart_uploads enable row level security;

drop policy if exists "multipart_uploads: own insert" on public.multipart_uploads;
drop policy if exists "multipart_uploads: own select" on public.multipart_uploads;
drop policy if exists "multipart_uploads: own delete" on public.multipart_uploads;

create policy "multipart_uploads: own insert"
  on public.multipart_uploads
  for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "multipart_uploads: own select"
  on public.multipart_uploads
  for select
  to authenticated
  using (auth.uid() = created_by);

create policy "multipart_uploads: own delete"
  on public.multipart_uploads
  for delete
  to authenticated
  using (auth.uid() = created_by);

notify pgrst, 'reload schema';
