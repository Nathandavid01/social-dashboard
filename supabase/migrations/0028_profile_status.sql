-- Migration 0028: per-user account status (active/inactive) for user admin.
-- Deactivated users are signed out and blocked from the dashboard.
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

notify pgrst, 'reload schema';
