-- ============================================================
-- Migration 0027: weekly posting quota + published_at + activity log
--
-- Three additions that power the live "weekly posting compliance"
-- dashboard (quota vs. published, per client, with status):
--   1. clients.weekly_post_quota  — how many posts/week the contract requires
--   2. content_ideas.published_at — when a video was actually published
--   3. content_idea_activity      — audit log: who did what, when
--
-- content_ideas + content_idea_activity are added to the Realtime
-- publication so the dashboard updates live as videos get published.
-- ============================================================

-- 1. Weekly posting quota on the client (nullable: NULL = "not set yet",
--    distinct from 0 = "no posts required"). Driven by the contract.
alter table public.clients
  add column if not exists weekly_post_quota int
    check (weekly_post_quota is null or (weekly_post_quota >= 0 and weekly_post_quota <= 100));

comment on column public.clients.weekly_post_quota is
  'Posts the client must publish per week, per their contract. NULL = not set.';

-- 2. published_at on content_ideas — the linchpin for "published THIS week".
alter table public.content_ideas
  add column if not exists published_at timestamptz;

create index if not exists content_ideas_published_at_idx
  on public.content_ideas (published_at desc);

-- Backfill existing 'publicada' rows so this-week counts don't undercount
-- on day one. We don't know the real publish time, so use updated_at.
update public.content_ideas
   set published_at = updated_at
 where status = 'publicada' and published_at is null;

-- Keep published_at in sync with status automatically. This covers BOTH
-- code paths that flip status to 'publicada': the direct updateIdeaStatus
-- action AND the sync_idea_status_from_task trigger (see 0009).
create or replace function public.set_idea_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'publicada' and new.published_at is null then
    new.published_at := now();
  elsif tg_op = 'UPDATE' and new.status <> 'publicada' and old.status = 'publicada' then
    -- Un-published (e.g. reverted by mistake) -> drop the timestamp so it
    -- stops counting toward the week.
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_idea_published_at on public.content_ideas;
create trigger trg_set_idea_published_at
  before insert or update on public.content_ideas
  for each row execute function public.set_idea_published_at();

-- 3. Activity log — every meaningful action on an idea, with actor + timestamp.
--    client_id is denormalized so the dashboard can aggregate per client
--    without a join on every row.
create table if not exists public.content_idea_activity (
  id               uuid primary key default uuid_generate_v4(),
  content_idea_id  uuid not null references public.content_ideas(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete set null,
  user_id          uuid references public.profiles(id) on delete set null,
  action           text not null,   -- 'recorded' | 'caption_generated' | 'caption_saved'
                                     -- | 'video_uploaded' | 'published' | 'assigned' | 'status_changed'
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists content_idea_activity_idea_idx    on public.content_idea_activity (content_idea_id, created_at desc);
create index if not exists content_idea_activity_client_idx  on public.content_idea_activity (client_id, created_at desc);
create index if not exists content_idea_activity_user_idx    on public.content_idea_activity (user_id, created_at desc);
create index if not exists content_idea_activity_created_idx on public.content_idea_activity (created_at desc);

alter table public.content_idea_activity enable row level security;

drop policy if exists "content_idea_activity: authenticated read"   on public.content_idea_activity;
drop policy if exists "content_idea_activity: authenticated insert" on public.content_idea_activity;
-- Read for any authenticated user; insert only your own rows (user_id = self).
-- No update/delete: an audit log is append-only.
create policy "content_idea_activity: authenticated read"   on public.content_idea_activity for select to authenticated using (true);
create policy "content_idea_activity: authenticated insert" on public.content_idea_activity for insert to authenticated with check (user_id is null or auth.uid() = user_id);

-- Enable Realtime on the activity log AND on content_ideas itself, so the
-- live dashboard reacts to publishes the moment they happen.
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin execute 'alter publication supabase_realtime add table public.content_idea_activity'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.content_ideas';        exception when duplicate_object then null; end;
  end if;
end $$;

notify pgrst, 'reload schema';
