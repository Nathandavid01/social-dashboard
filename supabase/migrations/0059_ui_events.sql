-- 0059 — Session breadcrumbs (clicks + route changes)
--
-- Owner-only log inside /actividad, modeled after Sentry breadcrumbs.
-- Authenticated users insert only their own rows. Nobody updates or deletes
-- via RLS; a cron with the service role prunes rows older than 7 days.

create table if not exists public.ui_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('click', 'navigate')),
  path        text not null check (char_length(path) between 1 and 200),
  label       text not null check (char_length(label) between 1 and 80),
  target      text,
  created_at  timestamptz not null default now()
);

create index if not exists ui_events_created_idx
  on public.ui_events (created_at desc);

create index if not exists ui_events_user_created_idx
  on public.ui_events (user_id, created_at desc);

comment on table public.ui_events is
  'Click and navigation breadcrumbs. Owner-readable. 7-day retention.';

alter table public.ui_events enable row level security;

drop policy if exists "ui_events: own insert" on public.ui_events;
drop policy if exists "ui_events: owner read" on public.ui_events;

create policy "ui_events: own insert"
  on public.ui_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ui_events: owner read"
  on public.ui_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

notify pgrst, 'reload schema';
