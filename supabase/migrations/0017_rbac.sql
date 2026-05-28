-- ============================================================
-- Migration 0017: RBAC roles — extend enum
-- ============================================================
-- Adds editor / video / supervisor to user_role enum.
-- The data migration (team_member → editor) is in migration 0021,
-- because Postgres won't let you use a newly-added enum value in the
-- same transaction.

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'editor'     and enumtypid = 'public.user_role'::regtype) then
    alter type public.user_role add value 'editor';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'video'      and enumtypid = 'public.user_role'::regtype) then
    alter type public.user_role add value 'video';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'supervisor' and enumtypid = 'public.user_role'::regtype) then
    alter type public.user_role add value 'supervisor';
  end if;
end $$;

notify pgrst, 'reload schema';
