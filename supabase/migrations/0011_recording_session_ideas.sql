-- ============================================================
-- Migration 0011: Recording Session Ideas
-- Links content_ideas to recording_sessions and adds 'grabada'
-- status to track the video buffer.
-- ============================================================

-- 1. Add recording_session_id column to content_ideas
alter table public.content_ideas
  add column if not exists recording_session_id uuid
    references public.recording_sessions(id) on delete set null;

create index if not exists content_ideas_session_idx
  on public.content_ideas (recording_session_id);

-- 2. Expand the status check constraint to include 'grabada'
--    'grabada' = footage recorded, sitting in the buffer awaiting editing
alter table public.content_ideas
  drop constraint if exists content_ideas_status_check;

alter table public.content_ideas
  add constraint content_ideas_status_check
    check (status in ('idea', 'asignada', 'grabada', 'producida', 'publicada', 'descartada'));

notify pgrst, 'reload schema';
