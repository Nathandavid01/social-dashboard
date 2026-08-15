-- 0061 — Análisis IA del video editado (Grok 4.6 sobre frames)
--
-- Una fila viva por video (unique video_id): re-subir el editado supersede el
-- análisis anterior vía upsert. Advisory: nunca bloquea aprobación.
-- El staff autenticado escribe (regido por app permissions) y lee.

create table if not exists public.content_idea_video_analysis (
  id              uuid primary key default uuid_generate_v4(),
  video_id        uuid not null references public.content_idea_videos(id) on delete cascade,
  idea_id         uuid not null references public.content_ideas(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'done', 'error')),
  findings        jsonb,
  visual_summary  text,
  model           text,
  error_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (video_id)
);

create index if not exists cva_idea_idx
  on public.content_idea_video_analysis (idea_id, updated_at desc);

comment on table public.content_idea_video_analysis is
  'Reporte advisory de Grok 4.6 sobre el video editado: captions quemados (gramática), relevancia con el cliente y resumen visual.';

alter table public.content_idea_video_analysis enable row level security;

drop policy if exists "cva: staff read" on public.content_idea_video_analysis;
drop policy if exists "cva: staff insert" on public.content_idea_video_analysis;
drop policy if exists "cva: staff update" on public.content_idea_video_analysis;

create policy "cva: staff read"
  on public.content_idea_video_analysis
  for select
  to authenticated
  using (true);

create policy "cva: staff insert"
  on public.content_idea_video_analysis
  for insert
  to authenticated
  with check (true);

create policy "cva: staff update"
  on public.content_idea_video_analysis
  for update
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
