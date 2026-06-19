-- Migration 0041: explicit caption ratings (learning loop, fase 2).
-- The team rates a generated caption 👍 (1) or 👎 (-1) with an optional note.
-- 👍 captions become the strongest "this is right for the client" examples;
-- 👎 captions (+ note) tell the generator what to AVOID. Both feed the per-client
-- caption prompt. We snapshot caption_text so the signal survives later edits.
CREATE TABLE IF NOT EXISTS public.caption_feedback (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  -- The idea it came from (content_ideas). Nullable so Idea-Lab / quick captions
  -- can also be rated later without a content_ideas row.
  idea_id      uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  caption_text text NOT NULL,
  rating       smallint NOT NULL CHECK (rating IN (-1, 1)),
  note         text,
  rated_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS caption_feedback_client_idx ON public.caption_feedback(client_id, rating, created_at DESC);

ALTER TABLE public.caption_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated team can read/write; the real gating lives in the server action
-- (captions.use), mirroring idea_lab_feedback.
DROP POLICY IF EXISTS "caption feedback read" ON public.caption_feedback;
CREATE POLICY "caption feedback read" ON public.caption_feedback
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "caption feedback write" ON public.caption_feedback;
CREATE POLICY "caption feedback write" ON public.caption_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
