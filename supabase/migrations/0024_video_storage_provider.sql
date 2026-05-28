-- Migration 0024: storage provider for content_idea_videos
-- 'drive' = legacy pasted Drive link; 'r2' = uploaded to Cloudflare R2.
-- For r2, drive_file_id holds the R2 object key (presigned URLs generated on demand).
alter table public.content_idea_videos
  add column if not exists storage_provider text not null default 'drive'
    check (storage_provider in ('drive', 'r2', 'supabase'));
notify pgrst, 'reload schema';
