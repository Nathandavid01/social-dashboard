-- ============================================================
-- Migration 0062: columnas de marca/captions en clients
-- ============================================================
-- Igual que 0061: estas columnas se crearon a mano en la base de producción y
-- nunca entraron al repo, así que en cualquier entorno nuevo las consultas que
-- las piden fallan enteras y la pantalla se queda sin datos —callándoselo—:
--   column clients.brand_voice does not exist
--
-- Las usan idea-lab-captions, caption-feedback, entregas-copy, planning y el
-- perfil del cliente. Todas `if not exists`: en producción ya están.

alter table public.clients
  add column if not exists brand_voice       text,
  add column if not exists caption_language  text,
  add column if not exists default_cta       text,
  add column if not exists caption_notes     text,
  add column if not exists default_hashtags  text,
  add column if not exists default_platforms public.social_platform[];

comment on column public.clients.brand_voice      is 'Cómo habla la marca — guía el texto que genera la IA.';
comment on column public.clients.caption_language is 'Idioma en que se escriben sus captions.';
comment on column public.clients.default_cta      is 'Llamada a la acción por defecto.';
comment on column public.clients.caption_notes    is 'Reglas acumuladas de qué NO hacer en sus captions.';
comment on column public.clients.default_hashtags is 'Hashtags que se añaden por defecto.';
comment on column public.clients.default_platforms is 'Plataformas donde publica por defecto.';
