-- Entregas sube a SU PROPIO bucket de R2, distinto del que usa el pipeline
-- original. Ambos escriben en content_idea_videos, y hasta ahora los dos casos
-- se marcaban 'r2' — con lo que al publicar era imposible saber de qué bucket
-- sacar la URL pública, y un video de Entregas se buscaba en el bucket viejo.
--
-- 'entregas-r2' hace explícito el origen. El CHECK existente no lo permitía.

alter table public.content_idea_videos
  drop constraint if exists content_idea_videos_storage_provider_check;

alter table public.content_idea_videos
  add constraint content_idea_videos_storage_provider_check
  check (storage_provider in ('drive', 'r2', 'supabase', 'entregas-r2'));
