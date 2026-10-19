-- Eric 2026-10-19: «borrar los posts del calendario pero que se queden en el banco, no quiero que cuenten».
-- A removed piece stays in Recibo (the bank) but gets no projected date and is left out of coverage counts.
-- Null = shown on the calendar. Metricool and the idea itself are untouched.
alter table public.content_ideas
  add column if not exists calendar_hidden_at timestamptz null;

comment on column public.content_ideas.calendar_hidden_at is
  'Quitada del calendario de publicaciones: sigue en Recibo, sin fecha proyectada ni conteo. Null = visible.';
