-- ============================================================
-- Migration 0019: content_idea_videos
-- ============================================================
-- One row per video file associated with a content_idea.
-- Files live in Google Drive (we only store the file_id + view link here).
-- kind = 'raw'   → videógrafo subió el material recién grabado
-- kind = 'edited'→ editor terminó y subió el resultado para QC

create table if not exists public.content_idea_videos (
  id              uuid primary key default gen_random_uuid(),
  idea_id         uuid not null references public.content_ideas(id) on delete cascade,
  kind            text not null check (kind in ('raw','edited')),
  name            text not null,
  drive_file_id   text,
  drive_view_link text,
  drive_thumb_url text,
  mime_type       text,
  size_bytes      bigint,
  duration_sec    int,
  notes           text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  status          text not null default 'uploaded'
                    check (status in ('uploading','uploaded','processing','failed','archived')),
  error_message   text,
  uploaded_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists content_idea_videos_idea_idx
  on public.content_idea_videos (idea_id, uploaded_at desc);
create index if not exists content_idea_videos_kind_idx
  on public.content_idea_videos (kind, status);
-- Single most-recent video per (idea, kind) is the canonical one; older are
-- treated as history. The application enforces "one active raw + one active
-- edited" by checking status='uploaded'.

alter table public.content_idea_videos enable row level security;

drop policy if exists "content_idea_videos: read"   on public.content_idea_videos;
drop policy if exists "content_idea_videos: insert" on public.content_idea_videos;
drop policy if exists "content_idea_videos: update" on public.content_idea_videos;
drop policy if exists "content_idea_videos: delete" on public.content_idea_videos;
create policy "content_idea_videos: read"   on public.content_idea_videos for select to authenticated using (true);
create policy "content_idea_videos: insert" on public.content_idea_videos for insert to authenticated with check (true);
create policy "content_idea_videos: update" on public.content_idea_videos for update to authenticated using (true) with check (true);
create policy "content_idea_videos: delete" on public.content_idea_videos for delete to authenticated using (true);

create or replace function public.set_content_idea_videos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_content_idea_videos_updated_at on public.content_idea_videos;
create trigger trg_content_idea_videos_updated_at
  before update on public.content_idea_videos
  for each row execute function public.set_content_idea_videos_updated_at();

notify pgrst, 'reload schema';
