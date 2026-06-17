-- Migration 0037: per-user area access granted by an admin.
-- area_access is a jsonb array of area hrefs (e.g. ["/clients","/team"]) the user
-- may reach, independent of their role. NULL = no per-user restriction (fall back
-- to the role's defaults), keeping every existing account fully unrestricted.
alter table public.profiles
  add column if not exists area_access jsonb;

notify pgrst, 'reload schema';
