-- ============================================================
-- Migration 0016: Weekly planning workflow + GPS for recording sessions
-- ============================================================

-- 1. GPS coordinates for recording sessions
alter table public.recording_sessions
  add column if not exists location_lat     numeric(9,6),
  add column if not exists location_lng     numeric(9,6),
  add column if not exists location_address text;

-- 2. Singleton workflow settings — configurable steps & thresholds
create table if not exists public.workflow_settings (
  id                          text primary key default 'global',
  weekly_planning_enabled     boolean not null default true,
  scheduling_window_days      int not null default 7,    -- "agendar dentro de los próximos N días"
  min_ideas_per_session       int not null default 4,    -- piso de ideas requeridas
  ideas_multiplier            numeric not null default 2.0, -- target = posting_days * multiplier (si > min)
  require_rescheduling        boolean not null default true, -- al pasar una sesión, exige agendar la próxima
  steps                       jsonb not null default '[
    {"slug":"scheduled","name":"Agendar próxima sesión","required":true},
    {"slug":"ideas","name":"Tener ideas listas","required":true},
    {"slug":"rescheduled","name":"Reagendar después de grabar","required":true}
  ]'::jsonb,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references public.profiles(id) on delete set null,
  constraint workflow_settings_singleton check (id = 'global')
);

insert into public.workflow_settings (id) values ('global')
  on conflict (id) do nothing;

alter table public.workflow_settings enable row level security;

drop policy if exists "workflow_settings: read"   on public.workflow_settings;
drop policy if exists "workflow_settings: update" on public.workflow_settings;
create policy "workflow_settings: read"
  on public.workflow_settings for select to authenticated using (true);
-- Only owners can edit settings
create policy "workflow_settings: update"
  on public.workflow_settings for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner'));

notify pgrst, 'reload schema';
