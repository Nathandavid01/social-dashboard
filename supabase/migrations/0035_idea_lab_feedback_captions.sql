-- Migration 0035: Captions + Metricool scheduling for approved Idea Lab ideas.
-- The "Ideas Aprobadas" screen now has a tab to generate a caption for an
-- approved idea and send it to Metricool scheduled for a chosen date (as a
-- DRAFT — nothing auto-publishes). These columns persist the generated caption
-- and the Metricool draft we created so the UI can show status and avoid
-- double-sending.

ALTER TABLE public.idea_lab_feedback
  ADD COLUMN IF NOT EXISTS generated_caption       text,
  ADD COLUMN IF NOT EXISTS caption_platform        text,
  ADD COLUMN IF NOT EXISTS caption_generated_at    timestamptz,
  -- Metricool draft bookkeeping. metricool_post_id != null => already sent
  -- (the idempotency guard, mirrors content_ideas).
  ADD COLUMN IF NOT EXISTS metricool_post_id        bigint,
  ADD COLUMN IF NOT EXISTS metricool_uuid           text,
  -- Naive "YYYY-MM-DDTHH:MM" local datetime the draft is scheduled for.
  ADD COLUMN IF NOT EXISTS metricool_scheduled_for  text,
  ADD COLUMN IF NOT EXISTS metricool_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS metricool_error          text;

notify pgrst, 'reload schema';
