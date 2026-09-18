-- Per-client posting timezone for cadence (frequency / days / times / zone).
-- Null until a person sets it — do not backfill or invent a zone.

alter table public.clients
  add column if not exists posting_timezone text;

comment on column public.clients.posting_timezone is
  'IANA timezone for this client posting cadence (e.g. America/Puerto_Rico). Null until a person sets it.';
