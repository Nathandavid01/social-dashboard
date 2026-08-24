-- Notas de quien grabó, en la misma idea (documento de toma).
-- No es el brief (visual_brief) ni las correcciones de Revisión.
alter table public.content_ideas
  add column if not exists shooting_notes text;

comment on column public.content_ideas.shooting_notes is
  'Anotaciones del videógrafo en On Site. El editor las lee en Revisión.';
