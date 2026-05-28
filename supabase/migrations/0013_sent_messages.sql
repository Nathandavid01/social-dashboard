-- ============================================================
-- Migration 0013: sent_messages
-- Audit log of SMS/WhatsApp messages sent to client owners.
-- ============================================================

create table if not exists public.sent_messages (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  to_phone            text not null,
  to_name             text,
  body                text not null,
  channel             text not null default 'sms' check (channel in ('sms','whatsapp')),
  status              text not null default 'queued' check (status in ('queued','sent','failed','delivered','undelivered')),
  provider            text not null default 'twilio',
  provider_message_id text,
  error_message       text,
  trigger_kind        text not null default 'manual' check (trigger_kind in ('manual','goal_reached','next_booking')),
  sent_by             uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists sent_messages_client_idx
  on public.sent_messages (client_id, created_at desc);
create index if not exists sent_messages_status_idx
  on public.sent_messages (status, created_at desc);

alter table public.sent_messages enable row level security;

drop policy if exists "sent_messages: authenticated read"   on public.sent_messages;
drop policy if exists "sent_messages: authenticated insert" on public.sent_messages;
drop policy if exists "sent_messages: authenticated update" on public.sent_messages;
create policy "sent_messages: authenticated read"   on public.sent_messages for select to authenticated using (true);
create policy "sent_messages: authenticated insert" on public.sent_messages for insert to authenticated with check (true);
create policy "sent_messages: authenticated update" on public.sent_messages for update to authenticated using (true) with check (true);

create or replace function public.set_sent_messages_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_sent_messages_updated_at on public.sent_messages;
create trigger trg_sent_messages_updated_at
  before update on public.sent_messages
  for each row execute function public.set_sent_messages_updated_at();

notify pgrst, 'reload schema';
