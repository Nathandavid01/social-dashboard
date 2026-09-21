-- ============================================================
-- Migration 0088: Pipeline occupancy — who is cutting this idea
-- ============================================================
-- Visibility claim on content_ideas (one cut per idea).
-- Lock column is editing_started_by. Do NOT add an FK to content_idea_videos
-- (PGRST201 /revision). Profile FK only, same as created_by / approved_by.
-- Not a pipeline stage: status / approval_status stay unchanged.

alter table public.content_ideas
  add column if not exists editing_started_at timestamptz;

alter table public.content_ideas
  add column if not exists editing_started_by uuid references public.profiles(id) on delete set null;

create index if not exists content_ideas_editing_started_by_idx
  on public.content_ideas (editing_started_by)
  where editing_started_by is not null;

comment on column public.content_ideas.editing_started_by is
  'Pipeline claim: who is cutting this idea now. Null = free. Occupancy lock.';

comment on column public.content_ideas.editing_started_at is
  'When the current Pipeline claim started. Ignored if editing_started_by is null.';

notify pgrst, 'reload schema';
