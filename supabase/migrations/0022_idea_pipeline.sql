-- ============================================================
-- Migration 0022: Idea-centric production pipeline
-- ============================================================
-- Connects the workflow: idea → caption (AI) → raw + b-rolls → edited.
--   - generated_caption lives on the idea (one caption per video/idea)
--   - content_idea_videos gains 'broll' kind (multiple b-rolls per idea)

-- 1. Caption stored on the idea
alter table public.content_ideas
  add column if not exists generated_caption     text,
  add column if not exists caption_platform       text,   -- instagram / tiktok / facebook…
  add column if not exists caption_generated_at   timestamptz;

-- 2. Allow 'broll' videos (in addition to raw + edited)
alter table public.content_idea_videos
  drop constraint if exists content_idea_videos_kind_check;
alter table public.content_idea_videos
  add constraint content_idea_videos_kind_check
    check (kind in ('raw', 'broll', 'edited'));

notify pgrst, 'reload schema';
