-- ============================================================
-- Migration 0015: posting_time + posting_schedule
-- Adds a typical posting time per client + optional per-day overrides.
-- ============================================================

alter table public.clients
  add column if not exists posting_time text,        -- "HH:MM" 24h, e.g. "14:30"
  add column if not exists posting_schedule jsonb    -- optional per-day: { "1": "14:30", "3": "10:00" }
    not null default '{}'::jsonb;

notify pgrst, 'reload schema';
