-- Migration 0066: aprendizaje por corrección, POR CLIENTE (Pieza 3, captions
-- distintos por lote). Cuando el equipo edita el caption que escribió la IA
-- antes de guardarlo (saveIdeaCaption), esa diferencia es la señal de
-- aprendizaje más valiosa que hay — y NO debe mezclarse entre clientes: una
-- corrección de tono para Lucky Pet no debe cambiar cómo se escribe para
-- Arasibo (decisión de Eric). Sigue el patrón de 0041_caption_feedback.sql.
--
-- Degrada seguro: si esta migración no se ha aplicado, saveIdeaCaption sigue
-- guardando el caption igual (el insert es best-effort, ver idea-captions.ts),
-- y generateIdeaCaption sigue generando igual (el fetch es best-effort, ver
-- lib/integrations/caption-corrections.ts).
CREATE TABLE IF NOT EXISTS public.caption_corrections (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  idea_id      uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  draft_text   text NOT NULL,
  final_text   text NOT NULL,
  corrected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS caption_corrections_client_idx
  ON public.caption_corrections(client_id, created_at DESC);

ALTER TABLE public.caption_corrections ENABLE ROW LEVEL SECURITY;

-- Authenticated team can read every client's corrections (needed to build the
-- per-client learning prompt); the real access gating lives in the server
-- action (captions.use / captions.edit), mirroring caption_feedback.
DROP POLICY IF EXISTS "caption corrections read" ON public.caption_corrections;
CREATE POLICY "caption corrections read" ON public.caption_corrections
  FOR SELECT TO authenticated USING (true);

-- Write is scoped to your own correction — you can only record a correction
-- as yourself, not on someone else's behalf.
DROP POLICY IF EXISTS "caption corrections write own" ON public.caption_corrections;
CREATE POLICY "caption corrections write own" ON public.caption_corrections
  FOR INSERT TO authenticated WITH CHECK (corrected_by = auth.uid());

NOTIFY pgrst, 'reload schema';
