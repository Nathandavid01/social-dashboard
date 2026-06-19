-- ============================================================================
-- Migraciones pendientes de aplicar en PRODUCCIÓN (Supabase: bgqdtfhelknmfudcvrzz)
-- Pégalo COMPLETO en el SQL Editor y dale RUN. Es idempotente (IF NOT EXISTS),
-- así que correrlo dos veces no rompe nada.
--   0032 → activa la AUTO-PUBLICACIÓN a Metricool
--   0033 → activa el bucle de aprendizaje del AI Idea Lab (aprobar/rechazar)
--   0034 → activa las FECHAS LÍMITE por video
-- ============================================================================

-- Requerido por uuid_generate_v4() en la migración 0033 (no-op si ya existe)
create extension if not exists "uuid-ossp";

-- ---------- 0032: Metricool auto-post bookkeeping ----------
alter table public.content_ideas
  add column if not exists metricool_post_id  bigint,
  add column if not exists metricool_uuid     text,
  add column if not exists posted_at          timestamptz,
  add column if not exists posting_error      text,
  add column if not exists posting_started_at timestamptz;

-- ---------- 0033: Idea Lab approve/reject feedback ----------
CREATE TABLE IF NOT EXISTS public.idea_lab_feedback (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  verdict             text NOT NULL CHECK (verdict IN ('approved', 'rejected')),
  content_type        text NOT NULL CHECK (content_type IN ('R', 'P', 'C', 'S')),
  objective           text,
  funnel_stage        text,
  title               text NOT NULL,
  hook                text,
  visual_brief        text,
  caption_angle       text,
  hashtags_suggestion text,
  rationale           text,
  theme               text,
  trends              text[] NOT NULL DEFAULT '{}',
  rated_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idea_lab_feedback_verdict_idx ON public.idea_lab_feedback(verdict, created_at DESC);
CREATE INDEX IF NOT EXISTS idea_lab_feedback_client_idx ON public.idea_lab_feedback(client_id);
ALTER TABLE public.idea_lab_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "idea feedback read" ON public.idea_lab_feedback;
CREATE POLICY "idea feedback read" ON public.idea_lab_feedback
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "idea feedback write" ON public.idea_lab_feedback;
CREATE POLICY "idea feedback write" ON public.idea_lab_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- 0034: user-settable deadline per video ----------
alter table public.content_ideas
  add column if not exists deadline date;
create index if not exists content_ideas_deadline_idx on public.content_ideas (deadline);

-- Refresca el cache del esquema de PostgREST
notify pgrst, 'reload schema';
