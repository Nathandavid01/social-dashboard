-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum ('owner', 'team_member');
create type public.client_status as enum ('active', 'paused', 'onboarding');
create type public.social_platform as enum ('instagram', 'facebook', 'tiktok', 'linkedin');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'blocked');
create type public.task_type as enum ('content_creation', 'scheduling', 'reporting', 'client_call', 'review', 'other');
create type public.alert_severity as enum ('info', 'warning', 'error', 'success');
create type public.content_status as enum ('draft', 'scheduled', 'published', 'cancelled');

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          public.user_role not null default 'team_member',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger: auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when (select count(*) from public.profiles) = 0 then 'owner'
      else 'team_member'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper function used in RLS policies
create or replace function public.get_my_role()
returns public.user_role
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
create table public.clients (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  industry        text,
  platforms       public.social_platform[] not null default '{}',
  status          public.client_status not null default 'onboarding',
  assigned_to     uuid references public.profiles(id) on delete set null,
  notes           text,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TASKS TABLE
-- ============================================================
create table public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  type            public.task_type not null default 'other',
  client_id       uuid references public.clients(id) on delete set null,
  assignee_id     uuid references public.profiles(id) on delete set null,
  status          public.task_status not null default 'pending',
  due_at          timestamptz,
  priority        smallint not null default 2 check (priority between 1 and 3),
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- ALERTS TABLE
-- ============================================================
create table public.alerts (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  message         text,
  severity        public.alert_severity not null default 'info',
  target_role     public.user_role,
  dismissed_by    uuid[] not null default '{}',
  created_by      uuid references public.profiles(id) on delete set null,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- CONTENT EVENTS TABLE
-- ============================================================
create table public.content_events (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  client_id       uuid references public.clients(id) on delete cascade,
  platform        public.social_platform not null,
  status          public.content_status not null default 'draft',
  scheduled_at    timestamptz not null,
  assignee_id     uuid references public.profiles(id) on delete set null,
  media_url       text,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- PERFORMANCE METRICS TABLE
-- ============================================================
create table public.performance_metrics (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  platform        public.social_platform not null,
  metric_date     date not null,
  followers       integer not null default 0,
  impressions     integer not null default 0,
  reach           integer not null default 0,
  engagements     integer not null default 0,
  posts_published smallint not null default 0,
  created_at      timestamptz not null default now(),
  unique (client_id, platform, metric_date)
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_clients_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

create trigger set_content_events_updated_at
  before update on public.content_events
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_clients_status          on public.clients(status);
create index idx_clients_assigned_to     on public.clients(assigned_to);
create index idx_clients_created_by      on public.clients(created_by);

create index idx_tasks_status            on public.tasks(status);
create index idx_tasks_assignee          on public.tasks(assignee_id);
create index idx_tasks_client            on public.tasks(client_id);
create index idx_tasks_due_at            on public.tasks(due_at);
create index idx_tasks_created_at        on public.tasks(created_at desc);

create index idx_alerts_severity         on public.alerts(severity);
create index idx_alerts_expires_at       on public.alerts(expires_at)
  where expires_at is not null;

create index idx_content_events_scheduled on public.content_events(scheduled_at);
create index idx_content_events_client    on public.content_events(client_id);
create index idx_content_events_platform  on public.content_events(platform);

create index idx_perf_metrics_client_date on public.performance_metrics(client_id, metric_date desc);
create index idx_perf_metrics_platform    on public.performance_metrics(platform);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.clients             enable row level security;
alter table public.tasks               enable row level security;
alter table public.alerts              enable row level security;
alter table public.content_events      enable row level security;
alter table public.performance_metrics enable row level security;

-- PROFILES RLS
create policy "profiles: authenticated read"
  on public.profiles for select to authenticated using (true);

create policy "profiles: own update"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles: owner update role"
  on public.profiles for update to authenticated
  using (public.get_my_role() = 'owner') with check (public.get_my_role() = 'owner');

-- CLIENTS RLS
create policy "clients: authenticated read"
  on public.clients for select to authenticated using (true);

create policy "clients: authenticated insert"
  on public.clients for insert to authenticated
  with check (auth.uid() = created_by);

create policy "clients: update"
  on public.clients for update to authenticated
  using (
    public.get_my_role() = 'owner'
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

create policy "clients: delete"
  on public.clients for delete to authenticated
  using (public.get_my_role() = 'owner');

-- TASKS RLS
create policy "tasks: authenticated read"
  on public.tasks for select to authenticated using (true);

create policy "tasks: authenticated insert"
  on public.tasks for insert to authenticated
  with check (auth.uid() = created_by);

create policy "tasks: update"
  on public.tasks for update to authenticated
  using (
    public.get_my_role() = 'owner'
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  );

create policy "tasks: delete"
  on public.tasks for delete to authenticated
  using (public.get_my_role() = 'owner' or created_by = auth.uid());

-- ALERTS RLS
create policy "alerts: read"
  on public.alerts for select to authenticated
  using (
    (expires_at is null or expires_at > now())
    and (target_role is null or target_role = public.get_my_role())
    and not (auth.uid() = any(dismissed_by))
  );

create policy "alerts: insert"
  on public.alerts for insert to authenticated
  with check (public.get_my_role() = 'owner');

create policy "alerts: dismiss update"
  on public.alerts for update to authenticated
  using (true) with check (true);

create policy "alerts: delete"
  on public.alerts for delete to authenticated
  using (public.get_my_role() = 'owner');

-- CONTENT EVENTS RLS
create policy "content_events: read"
  on public.content_events for select to authenticated using (true);

create policy "content_events: insert"
  on public.content_events for insert to authenticated
  with check (auth.uid() = created_by);

create policy "content_events: update"
  on public.content_events for update to authenticated
  using (
    public.get_my_role() = 'owner'
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  );

create policy "content_events: delete"
  on public.content_events for delete to authenticated
  using (public.get_my_role() = 'owner' or created_by = auth.uid());

-- PERFORMANCE METRICS RLS
create policy "performance_metrics: read"
  on public.performance_metrics for select to authenticated using (true);

create policy "performance_metrics: owner write"
  on public.performance_metrics for all to authenticated
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.alerts;
