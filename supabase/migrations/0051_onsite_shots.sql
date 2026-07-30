-- On Site: la lista de grabación de una sesión, agrupada por tipo de toma.
--
-- Las tomas SON content_ideas: marcar la burbuja pone status='grabada', el
-- mismo estado que usa el resto de la app. Una tabla aparte daría dos números
-- de "grabadas" que pueden discrepar.
--
-- shot_type es texto, no enum, a propósito: añadir un tipo de cámara no debe
-- costar una migración.

alter table public.content_ideas
  add column if not exists shot_type text,
  add column if not exists reference_url text;

-- Filtrar la lista por tipo dentro de una sesión es la consulta de la pantalla.
create index if not exists idx_content_ideas_session_shot
  on public.content_ideas(recording_session_id, shot_type);
