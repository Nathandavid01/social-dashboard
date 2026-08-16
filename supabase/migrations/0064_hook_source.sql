-- 0064 — Marca de procedencia del hook ("¿De qué es este video?").
--
-- v3.40: cuando la IA analiza el video, escribe `video_topic` en la casilla
-- del hook SOLO si estaba vacía (nunca pisa texto de una persona) — ver
-- app/api/video-analysis/route.ts. Esta columna distingue "lo escribió la
-- IA" de "lo escribió alguien del equipo" para poder mostrar una marca
-- discreta y editable en la UI. Se limpia (vuelve a null) en cuanto una
-- persona edita el hook a mano. Degrada seguro: sin esta columna, el hook
-- se escribe igual (best-effort en un UPDATE separado) y la UI simplemente
-- no muestra la marca.

alter table public.content_ideas
  add column if not exists hook_source text;

comment on column public.content_ideas.hook_source is
  'Procedencia del hook actual: ''ai'' cuando lo escribió el análisis de video (video_topic); null cuando lo escribió una persona o no se ha tocado. Se limpia a null en cuanto alguien edita el campo a mano.';

notify pgrst, 'reload schema';
