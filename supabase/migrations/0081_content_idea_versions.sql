-- Version history for content idea text/status overwrites (recovery / Historial).
-- Append-only: each mutation that would lose prior text/status inserts a snapshot first.
create table if not exists public.content_idea_versions (
  id               uuid primary key default gen_random_uuid(),
  content_idea_id  uuid not null references public.content_ideas(id) on delete cascade,
  snapshot         jsonb not null,
  reason           text not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists content_idea_versions_idea_idx
  on public.content_idea_versions (content_idea_id, created_at desc);

alter table public.content_idea_versions enable row level security;

drop policy if exists "content_idea_versions: authenticated read"   on public.content_idea_versions;
drop policy if exists "content_idea_versions: authenticated insert" on public.content_idea_versions;

-- Match content_idea_activity: any authenticated user can read; insert as self (or null).
create policy "content_idea_versions: authenticated read"
  on public.content_idea_versions for select to authenticated using (true);
create policy "content_idea_versions: authenticated insert"
  on public.content_idea_versions for insert to authenticated
  with check (created_by is null or auth.uid() = created_by);

notify pgrst, 'reload schema';
