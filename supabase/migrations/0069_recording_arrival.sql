-- Sello de llegada: evidencia de que el equipo de grabación pisó el local.
alter table public.recording_sessions
  add column if not exists arrived_at timestamptz,
  add column if not exists arrived_by uuid references public.profiles(id);

create index if not exists recording_sessions_arrived_at_idx
  on public.recording_sessions (arrived_at)
  where arrived_at is not null;
