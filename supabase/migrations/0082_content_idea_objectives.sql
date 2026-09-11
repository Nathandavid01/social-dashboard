-- Objetivo y etapa del embudo en content_ideas (antes solo en idea_lab_feedback).
-- On Site / propuesta PDF / lote leen estas columnas con fallback si aún no existen.
alter table public.content_ideas
  add column if not exists objective text,
  add column if not exists funnel_stage text;
