-- ============================================================
-- Migration 0073: clients.brand_fonts
-- ============================================================
-- Tipografías de marca por cliente (nombres, no archivos — los
-- archivos .ttf/.otf ya viven en client_assets kind='font').
-- Shape: { "primary": "Montserrat Bold", "secondary": "Lato" }
-- Editadas en la pestaña Marca; las Gráficas IA las usan para
-- pedir un estilo tipográfico consistente con la marca.

alter table public.clients
  add column if not exists brand_fonts jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
