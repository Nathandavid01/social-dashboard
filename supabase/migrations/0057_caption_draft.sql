-- Migration 0057: el caption generado por IA es un BORRADOR, no un envío.
--
-- `ideaStage()` (lib/entregas/batches.ts) manda a Publicación todo video
-- aprobado cuyo `generated_caption` no esté vacío. Como `generateIdeaCaption`
-- escribía ese mismo campo, apretar "Generar con IA" sacaba el video de la
-- columna Copy sin que nadie leyera, editara ni aprobara el texto.
--
-- Con `caption_draft` los dos estados dejan de ser el mismo campo:
--   caption_draft      → lo que escribió la IA, todavía de nadie
--   generated_caption  → lo que un humano guardó; ESTO mueve la etapa
--
-- Aditivo y sin backfill a propósito: los captions que ya están en
-- `generated_caption` son los que el equipo dio por buenos en su momento, y
-- moverlos a borrador devolvería a Copy videos que ya están en Publicación.
ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS caption_draft text;

COMMENT ON COLUMN public.content_ideas.caption_draft IS
  'Caption generado por IA todavía sin revisar. Guardar lo promueve a generated_caption y deja esta columna en NULL. No influye en la etapa del pipeline.';
