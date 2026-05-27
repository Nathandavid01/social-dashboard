-- ============================================================
-- Migration 0007: Add title column to profiles
-- ============================================================
-- Adds a "title" field for agency org titles (COO, Marketing Director, etc.)
-- Separate from "role" which controls permissions (owner/team_member).

alter table public.profiles
  add column if not exists title text;

-- Optional backfill for team roster (run after Nathan creates team accounts):
-- update public.profiles set title = 'COO' where email = 'Denishamatos@natemediapr.com';
-- update public.profiles set title = 'Marketing Director' where email = 'Anibelizfuentes@natemediapr.com';
-- update public.profiles set title = 'Head Editor' where email = 'Carlosvillalta@natemediapr.com';
-- update public.profiles set title = 'Production Manager' where email = 'alondrardz@natemediapr.com';

notify pgrst, 'reload schema';
