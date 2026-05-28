-- ============================================================
-- Migration 0014: Personal notifications
-- Per-user notification feed shown in the topbar bell dropdown.
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in (
    'task_assigned', 'task_due_soon', 'task_overdue', 'task_completed',
    'request_new', 'review_pending', 'review_approved', 'review_rejected',
    'mention', 'client_message', 'payment_received', 'meeting_reminder',
    'goal_reached', 'system'
  )),
  title       text not null,
  body        text,
  link        text,
  severity    text not null default 'info' check (severity in ('info','success','warning','error')),
  meta        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_all_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own"   on public.notifications;
drop policy if exists "notifications: insert"    on public.notifications;
drop policy if exists "notifications: update own" on public.notifications;
drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: read own"   on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications: insert"     on public.notifications for insert to authenticated with check (true);
create policy "notifications: update own" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications: delete own" on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- Enable Realtime
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin
      execute 'alter publication supabase_realtime add table public.notifications';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
