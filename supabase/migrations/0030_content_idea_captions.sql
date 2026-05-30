-- Per-platform captions for a content idea (one caption per chosen social network),
-- so step 1 can generate + edit a tailored caption for each platform instead of a
-- single shared one. The legacy single caption stays in content_ideas.generated_caption
-- for back-compat; this table is the source of truth once populated.

CREATE TABLE IF NOT EXISTS public.content_idea_captions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id       uuid NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
  platform      text NOT NULL CHECK (platform IN ('instagram','facebook','tiktok','linkedin')),
  caption       text,
  generated_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, platform)
);

CREATE INDEX IF NOT EXISTS content_idea_captions_idea_idx ON public.content_idea_captions(idea_id);

ALTER TABLE public.content_idea_captions ENABLE ROW LEVEL SECURITY;

-- Authenticated team members can read/write (mirrors content_ideas access).
DROP POLICY IF EXISTS "idea captions read" ON public.content_idea_captions;
CREATE POLICY "idea captions read" ON public.content_idea_captions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "idea captions write" ON public.content_idea_captions;
CREATE POLICY "idea captions write" ON public.content_idea_captions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
