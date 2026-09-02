-- Huella de contenido por video subido (v4.10): la misma grabación no se
-- registra dos veces. Tabla aparte de content_idea_videos a propósito: el
-- registro del video no depende de que esta migración esté aplicada (la app
-- escribe aquí best-effort y consulta con tolerancia a "tabla no existe").
-- La clave primaria ES la huella: la unicidad la garantiza la base.
create table if not exists public.content_idea_video_fingerprints (
  fingerprint text primary key,
  video_id uuid not null references public.content_idea_videos(id) on delete cascade,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists content_idea_video_fingerprints_video_idx
  on public.content_idea_video_fingerprints (video_id);

alter table public.content_idea_video_fingerprints enable row level security;
drop policy if exists "video fingerprints read" on public.content_idea_video_fingerprints;
drop policy if exists "video fingerprints insert" on public.content_idea_video_fingerprints;
create policy "video fingerprints read" on public.content_idea_video_fingerprints
  for select to authenticated using (true);
create policy "video fingerprints insert" on public.content_idea_video_fingerprints
  for insert to authenticated with check (true);
