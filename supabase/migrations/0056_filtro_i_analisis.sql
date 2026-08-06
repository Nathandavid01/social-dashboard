-- ============================================================
-- Migration 0056: filtro_i_analisis
-- ============================================================
-- El análisis automático de un video entregado por Filtro I:
--   1. WhisperAPI transcribe el audio (con timestamps)
--   2. Grok lee los frames + la transcripción → errores + caption base
--   3. El agente de captions convierte el caption base en el caption final
--
-- Una fila por video analizado. El estado se guarda paso a paso para que un
-- reintento no vuelva a pagar la transcripción ni la llamada de visión.
--
-- caption_base / caption_final viven aquí aunque Filtro I NO los enseñe: el
-- editor solo ve la tabla de errores. Los lee el área Grok-ing, y tenerlos en
-- la misma fila es lo que hará barato integrarlos con Copy más adelante.

create table if not exists public.filtro_i_analisis (
  id            uuid primary key default gen_random_uuid(),
  idea_id       uuid not null references public.content_ideas(id) on delete cascade,
  video_id      uuid not null references public.content_idea_videos(id) on delete cascade,

  -- El paso alcanzado. El orquestador avanza de uno en uno y persiste después
  -- de cada uno; 'error' guarda en qué paso murió para poder reanudar.
  status        text not null default 'pendiente'
                  check (status in ('pendiente','transcribiendo','analizando','redactando','listo','error')),
  error_paso    text,
  error_mensaje text,

  -- Segundos de cada frame extraído en el navegador, en orden. Grok los usa
  -- para poder decir "el error está por el segundo 9.6" y para alinear el
  -- subtítulo de un frame con lo que se oye en ese instante.
  frame_momentos jsonb,
  frames_count   int not null default 0,

  -- [{ inicio, fin, texto }] tal como los devuelve WhisperAPI.
  transcripcion jsonb,

  -- [{ texto_incorrecto, correccion, tipo, momento_seg }]
  errores       jsonb,

  caption_base  text,
  caption_final text,

  modelo_vision text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Un análisis por video: reanalizar sobrescribe en vez de acumular filas
-- muertas que la pantalla tendría que desempatar.
create unique index if not exists filtro_i_analisis_video_uidx
  on public.filtro_i_analisis (video_id);
create index if not exists filtro_i_analisis_idea_idx
  on public.filtro_i_analisis (idea_id, created_at desc);
-- El poll de la tarjeta busca por estado: los que siguen en vuelo.
create index if not exists filtro_i_analisis_status_idx
  on public.filtro_i_analisis (status);

alter table public.filtro_i_analisis enable row level security;

drop policy if exists "filtro_i_analisis: read"   on public.filtro_i_analisis;
drop policy if exists "filtro_i_analisis: insert" on public.filtro_i_analisis;
drop policy if exists "filtro_i_analisis: update" on public.filtro_i_analisis;
drop policy if exists "filtro_i_analisis: delete" on public.filtro_i_analisis;
-- Igual que content_idea_videos: RLS abierta a authenticated y el reparto real
-- lo hace la app (requirePermission + el filtro por cliente asignado). Quien no
-- puede ver el caption no llega a la consulta que lo trae.
create policy "filtro_i_analisis: read"   on public.filtro_i_analisis for select to authenticated using (true);
create policy "filtro_i_analisis: insert" on public.filtro_i_analisis for insert to authenticated with check (true);
create policy "filtro_i_analisis: update" on public.filtro_i_analisis for update to authenticated using (true) with check (true);
create policy "filtro_i_analisis: delete" on public.filtro_i_analisis for delete to authenticated using (true);

create or replace function public.set_filtro_i_analisis_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_filtro_i_analisis_updated_at on public.filtro_i_analisis;
create trigger trg_filtro_i_analisis_updated_at
  before update on public.filtro_i_analisis
  for each row execute function public.set_filtro_i_analisis_updated_at();

notify pgrst, 'reload schema';
