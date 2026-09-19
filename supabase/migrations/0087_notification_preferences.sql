-- ============================================================
-- Migration 0087: per-user notification display preferences
-- ============================================================
-- Shape stored in profiles.notification_preferences:
--   { "client_review_toast": true|false }
-- Missing keys default to ON in app code (toast shown).
-- Does NOT affect storage of client review votes.

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
