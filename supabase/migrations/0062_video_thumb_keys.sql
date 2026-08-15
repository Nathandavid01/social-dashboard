-- 0062 — Tira de 5 escenas: thumbnails guardados al subir el video editado.
--
-- 5 de los 8 frames que ya se extraen para el QC IA (0061) se suben como JPGs
-- chiquitos al mismo bucket del video y sus keys quedan aquí. Degrada seguro:
-- sin esta columna (o con thumb_keys null/vacío), el panel simplemente pinta
-- la tira al vuelo desde el preview firmado — nunca rompe la subida ni el panel.

alter table public.content_idea_videos
  add column if not exists thumb_keys jsonb;

comment on column public.content_idea_videos.thumb_keys is
  'Array JSON con las keys (R2) de 5 thumbnails JPG del video, en orden. Null/vacío → el panel pinta la tira al vuelo desde el preview.';

notify pgrst, 'reload schema';
