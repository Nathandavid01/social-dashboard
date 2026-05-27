-- ============================================================
-- Migration 0008: saved_captions table
-- ============================================================
-- Persists AI-generated captions so history survives refresh
-- and is shared across devices/team members.

create table if not exists public.saved_captions (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid references public.clients(id) on delete set null,
  video_review_id uuid references public.video_reviews(id) on delete set null,
  generated_by    uuid references public.profiles(id) on delete set null,
  video_title     text,
  platform        text,
  caption         text not null,
  examples_used   int not null default 0,
  model           text,
  created_at      timestamptz not null default now()
);

create index if not exists saved_captions_client_idx on public.saved_captions (client_id);
create index if not exists saved_captions_created_idx on public.saved_captions (created_at desc);
create index if not exists saved_captions_video_review_idx on public.saved_captions (video_review_id);

alter table public.saved_captions enable row level security;

drop policy if exists "saved_captions: authenticated read"   on public.saved_captions;
drop policy if exists "saved_captions: authenticated insert" on public.saved_captions;
drop policy if exists "saved_captions: authenticated update" on public.saved_captions;
drop policy if exists "saved_captions: authenticated delete" on public.saved_captions;
create policy "saved_captions: authenticated read"   on public.saved_captions for select to authenticated using (true);
create policy "saved_captions: authenticated insert" on public.saved_captions for insert to authenticated with check (true);
create policy "saved_captions: authenticated update" on public.saved_captions for update to authenticated using (true) with check (true);
create policy "saved_captions: authenticated delete" on public.saved_captions for delete to authenticated using (true);

notify pgrst, 'reload schema';
