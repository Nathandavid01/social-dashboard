-- ============================================================
-- CLIENT REQUESTS TABLE (for the public client portal)
-- Accepts anonymous inserts (no auth required)
-- ============================================================
create table if not exists public.client_requests (
  id              uuid primary key default uuid_generate_v4(),
  company_name    text not null,
  contact_name    text not null,
  contact_email   text,
  contact_phone   text,
  request_type    text not null default 'general',
  description     text not null,
  urgency         text not null default 'normal',
  status          text not null default 'new',
  task_id         uuid references public.tasks(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.client_requests enable row level security;

-- Anyone (even not logged in) can submit a request
create policy "client_requests: public insert"
  on public.client_requests for insert
  to anon, authenticated
  with check (true);

-- Only authenticated users (the team) can view requests
create policy "client_requests: authenticated read"
  on public.client_requests for select
  to authenticated
  using (true);

-- Team can update (change status, add notes, link to task)
create policy "client_requests: authenticated update"
  on public.client_requests for update
  to authenticated
  using (true) with check (true);

-- Team can delete
create policy "client_requests: authenticated delete"
  on public.client_requests for delete
  to authenticated
  using (true);

-- Updated_at trigger
create or replace function public.set_client_requests_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_client_requests_updated_at
  before update on public.client_requests
  for each row execute function public.set_client_requests_updated_at();

-- ============================================================
-- TASK COMMENTS TABLE (for ClickUp-style team communication)
-- ============================================================
create table if not exists public.task_comments (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (length(content) > 0 and length(content) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.task_comments enable row level security;

create policy "task_comments: authenticated read"
  on public.task_comments for select
  to authenticated using (true);

create policy "task_comments: authenticated insert"
  on public.task_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "task_comments: own update"
  on public.task_comments for update
  to authenticated
  using (auth.uid() = author_id);

create policy "task_comments: owner or author delete"
  on public.task_comments for delete
  to authenticated
  using (auth.uid() = author_id or public.get_my_role() = 'owner');

-- Updated_at trigger
create or replace function public.set_task_comments_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_task_comments_updated_at();
