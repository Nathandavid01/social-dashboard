-- Migration 0032: Idea Lab approve/reject feedback.
-- Each AI-generated idea can be approved (✓) or rejected (✗) by the marketing
-- team. Approved ideas surface in "Ideas Aprobadas" for editors/designers, and
-- BOTH verdicts feed the learning loop so the generator self-educates on what
-- the agency considers a good vs. bad idea.

CREATE TABLE IF NOT EXISTS public.idea_lab_feedback (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- null = general brainstorming (not tied to a client)
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

-- Authenticated team members can read/write (gating is enforced in the server
-- actions via the permission system — mirrors content_ideas access).
DROP POLICY IF EXISTS "idea feedback read" ON public.idea_lab_feedback;
CREATE POLICY "idea feedback read" ON public.idea_lab_feedback
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "idea feedback write" ON public.idea_lab_feedback;
CREATE POLICY "idea feedback write" ON public.idea_lab_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

notify pgrst, 'reload schema';
