-- 0067 — Tiempo en el dashboard (Jornada).
--
-- Un renglón por persona y día (calendario de Puerto Rico). El latido del
-- browser suma segundos solo si el hueco es ≤ 3 min — pestaña olvidada no
-- cuenta. El equipo puede LEER el tablero (gamificación); cada quien solo
-- ESCRIBE su propia fila. Degrada seguro: sin esta tabla, el latido falla
-- en silencio y /actividad no muestra la Jornada.

create table if not exists public.user_time_days (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  day             date not null,
  active_seconds  integer not null default 0 check (active_seconds >= 0),
  last_beat_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists user_time_days_day_idx
  on public.user_time_days (day desc);

comment on table public.user_time_days is
  'Segundos activos por persona y día (America/Puerto_Rico). Fuente de la Jornada.';

alter table public.user_time_days enable row level security;

drop policy if exists "user_time_days: own insert" on public.user_time_days;
drop policy if exists "user_time_days: own update" on public.user_time_days;
drop policy if exists "user_time_days: team read" on public.user_time_days;

create policy "user_time_days: own insert"
  on public.user_time_days
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_time_days: own update"
  on public.user_time_days
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_time_days: team read"
  on public.user_time_days
  for select
  to authenticated
  using (true);

grant select, insert, update on public.user_time_days to authenticated;

notify pgrst, 'reload schema';
