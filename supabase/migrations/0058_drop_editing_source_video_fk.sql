-- Permanent fix for PostgREST PGRST201:
-- "Could not embed because more than one relationship was found for
--  'content_ideas' and 'content_idea_videos'"
--
-- There were two FKs between the tables:
--   1. content_idea_videos.idea_id → content_ideas.id   (the real one-to-many)
--   2. content_ideas.editing_source_video_id → content_idea_videos.id  (unused reverse)
--
-- The reverse FK is not referenced by application code. Dropping it leaves a
-- single relationship so embeds like content_idea_videos(...) work without a
-- !foreign_key hint (and so a forgotten hint can never take production down).
-- The column is kept in case historical values still exist.

alter table public.content_ideas
  drop constraint if exists content_ideas_editing_source_video_id_fkey;
