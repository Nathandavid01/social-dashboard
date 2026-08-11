-- ============================================================
-- Migration 0061: clients.metricool_blog_id
-- ============================================================
-- La columna existía SOLO en la base de producción (creada a mano desde el
-- dashboard), pero el código la usa en varios sitios: metricool-weekly,
-- client-onboarding, weekly-compliance, posting, video-reviews… En cualquier
-- entorno nuevo esas consultas fallaban con
--   column clients.metricool_blog_id does not exist
-- y la app caía en su ruta de respaldo, así que la pantalla "cargaba" pero sin
-- datos de Metricool y sin que nadie se enterara.
--
-- `if not exists`: en producción ya está y esto no la toca.

alter table public.clients
  add column if not exists metricool_blog_id text;

comment on column public.clients.metricool_blog_id is
  'Blog id del cliente en Metricool. Null = todavía no conectado.';
