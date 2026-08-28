-- Cadena de custodia del video: lo que se aprueba es lo que se publica.
--
-- Hasta ahora ninguna aprobación quedaba atada a un archivo concreto: apuntaba
-- a la idea, y al publicar se re-resolvía "el edited vivo más nuevo". Si el
-- editor subía otro corte después de aprobar, se publicaba ese — sin que nadie
-- lo aprobara.
--
-- ATENCIÓN: `approved_video_id` es un uuid SIN foreign key a propósito. Un
-- SEGUNDO FK entre content_ideas y content_idea_videos hace que PostgREST no
-- sepa cuál usar y rompe TODOS los embeds `content_idea_videos(...)` con
-- PGRST201 — se llevó por delante /revision una vez y por eso existe la
-- migración 0058, que dropeó justo un FK así (editing_source_video_id).
-- La integridad se mantiene en la aplicación y en el trigger de abajo.

alter table content_ideas
  add column if not exists approved_video_id uuid;

comment on column content_ideas.approved_video_id is
  'content_idea_videos.id aprobado. Sin FK a propósito: un segundo FK rompe los embeds de PostgREST (ver 0058).';

-- El voto del cliente también sella el archivo que vio.
alter table entregas_client_review_items
  add column if not exists video_file_id uuid;

comment on column entregas_client_review_items.video_file_id is
  'content_idea_videos.id que el cliente vio y votó. Sin FK, misma razón que approved_video_id.';

create index if not exists idx_content_ideas_approved_video
  on content_ideas (approved_video_id)
  where approved_video_id is not null;

-- Subir un corte nuevo después de aprobar (y antes de publicar) invalida la
-- aprobación: el video vuelve a "por aprobar" y el corte nuevo se revisa.
-- Nunca toca ideas ya publicadas o agendadas — ahí el archivo ya salió.
create or replace function invalidate_approval_on_reupload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'edited' then
    return new;
  end if;

  update content_ideas
     set approval_status = 'submitted',
         approved_video_id = null
   where id = new.idea_id
     and approval_status = 'approved'
     and published_at is null
     and metricool_post_id is null
     -- Un re-registro del MISMO archivo (reintento de subida) no invalida nada.
     and (approved_video_id is null or approved_video_id <> new.id);

  return new;
end;
$$;

drop trigger if exists trg_invalidate_approval_on_reupload on content_idea_videos;
create trigger trg_invalidate_approval_on_reupload
  after insert on content_idea_videos
  for each row
  execute function invalidate_approval_on_reupload();
