-- Confirmation status for recording sessions: Confirmed when client + videographer + start_time
-- are set (or via explicit Confirmar). Distinct from schedule completeness / need-to-schedule.

alter table public.recording_sessions
  add column if not exists confirmation_status text not null default 'unconfirmed';

alter table public.recording_sessions
  drop constraint if exists recording_sessions_confirmation_status_check;

alter table public.recording_sessions
  add constraint recording_sessions_confirmation_status_check
  check (confirmation_status in ('unconfirmed', 'confirmed'));

create index if not exists recording_sessions_date_confirmation_idx
  on public.recording_sessions (session_date, confirmation_status);

notify pgrst, 'reload schema';
