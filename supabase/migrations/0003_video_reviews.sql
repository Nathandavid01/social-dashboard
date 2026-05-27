-- ============================================================
-- VIDEO REVIEWS TABLE
-- Editors submit videos for QC review by the team
-- ============================================================
create table if not exists public.video_reviews (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  drive_link      text not null,
  client_id       uuid references public.clients(id) on delete set null,
  editor_id       uuid references public.profiles(id) on delete set null,
  reviewer_id     uuid references public.profiles(id) on delete set null,
  status          text not null default 'submitted',
  -- error type slugs selected by reviewer
  errors          text[] not null default '{}',
  -- reviewer notes per error / overall feedback
  error_notes     text,
  general_notes   text,
  revision_count  int not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Constraint: valid statuses
alter table public.video_reviews
  add constraint video_reviews_status_check
  check (status in ('submitted', 'in_review', 'revision_needed', 'approved'));

alter table public.video_reviews enable row level security;

create policy "video_reviews: authenticated read"
  on public.video_reviews for select
  to authenticated using (true);

create policy "video_reviews: authenticated insert"
  on public.video_reviews for insert
  to authenticated with check (true);

create policy "video_reviews: authenticated update"
  on public.video_reviews for update
  to authenticated using (true) with check (true);

create policy "video_reviews: authenticated delete"
  on public.video_reviews for delete
  to authenticated using (true);

-- Updated_at trigger
create or replace function public.set_video_reviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_video_reviews_updated_at
  before update on public.video_reviews
  for each row execute function public.set_video_reviews_updated_at();
