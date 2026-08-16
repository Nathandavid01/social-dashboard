-- 0063 — Cuántos fotogramas analizó la IA, por video.
--
-- Eric quiere ver el número junto a las bolitas QC ("48 fotogramas
-- analizados"). Con troceado (chunks de hasta 64) el número se ACUMULA:
-- cada request suma su cantidad de frames a lo ya guardado — ver
-- app/api/video-analysis/route.ts. Degrada seguro: sin esta columna, la ruta
-- sigue escribiendo status/findings normalmente (el conteo se guarda con un
-- UPDATE separado, best-effort) y la UI simplemente no muestra la línea del
-- contador.

alter table public.content_idea_video_analysis
  add column if not exists frame_count integer;

comment on column public.content_idea_video_analysis.frame_count is
  'Total de fotogramas analizados por la IA para este video (acumulado entre chunks). Null → no se muestra el contador en la UI.';

notify pgrst, 'reload schema';
