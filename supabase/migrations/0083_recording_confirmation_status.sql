-- Dual-party recording confirmation.
-- Confirmada ONLY when BOTH videographer and client have explicitly confirmed
-- (videographer_confirmed_at AND client_confirmed_at are set).
-- confirmation_status is a denormalized cache for filters/index; app helpers
-- treat effective Confirmada as both timestamps present (not field-complete).

alter table public.recording_sessions
  add column if not exists videographer_confirmed_at timestamptz;

alter table public.recording_sessions
  add column if not exists client_confirmed_at timestamptz;

alter table public.recording_sessions
  add column if not exists confirmation_status text not null default 'unconfirmed';

alter table public.recording_sessions
  drop constraint if exists recording_sessions_confirmation_status_check;

alter table public.recording_sessions
  add constraint recording_sessions_confirmation_status_check
  check (confirmation_status in ('unconfirmed', 'confirmed'));

-- Backfill cache from dual timestamps (idempotent).
update public.recording_sessions
set confirmation_status = case
  when videographer_confirmed_at is not null and client_confirmed_at is not null then 'confirmed'
  else 'unconfirmed'
end
where confirmation_status is distinct from (
  case
    when videographer_confirmed_at is not null and client_confirmed_at is not null then 'confirmed'
    else 'unconfirmed'
  end
);

create index if not exists recording_sessions_date_confirmation_idx
  on public.recording_sessions (session_date, confirmation_status);

create index if not exists recording_sessions_dual_confirm_idx
  on public.recording_sessions (session_date, videographer_confirmed_at, client_confirmed_at);

notify pgrst, 'reload schema';
