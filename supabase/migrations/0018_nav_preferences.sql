-- ============================================================
-- Migration 0018: per-user sidebar preferences
-- ============================================================
-- Shape stored in profiles.nav_preferences:
--   { "order": ["/home", "/planning", …], "hidden": ["/automation", …] }
-- Order is partial — items not in the array fall back to default order.

alter table public.profiles
  add column if not exists nav_preferences jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
