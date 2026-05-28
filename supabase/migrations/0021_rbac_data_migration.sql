-- ============================================================
-- Migration 0021: RBAC data migration
-- ============================================================
-- Reassigns existing 'team_member' rows to 'editor' (safe default — full
-- content access, no billing/contract).
-- Runs in its own transaction so the enum values added in 0017 are usable.

update public.profiles set role = 'editor' where role::text = 'team_member';

notify pgrst, 'reload schema';
