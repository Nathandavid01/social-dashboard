-- Migration 0032: Metricool auto-post bookkeeping on content_ideas
-- When a fully-ready idea (caption + edited video + approved) is published to
-- Metricool, we record the returned post id/uuid for IDEMPOTENCY (so we never
-- double-post) plus an error string for the last failed attempt. These columns
-- are written ONLY via the gated server actions in lib/actions/idea-posting.ts.
alter table public.content_ideas
  add column if not exists metricool_post_id  bigint,
  add column if not exists metricool_uuid     text,
  add column if not exists posted_at          timestamptz,
  add column if not exists posting_error      text,
  -- Atomic claim slot: a publish attempt sets this `where metricool_post_id is
  -- null` before calling Metricool, so two concurrent triggers (approve + manual
  -- button, retries) can't double-post. A stale claim (>5 min) is reclaimable.
  add column if not exists posting_started_at timestamptz;

notify pgrst, 'reload schema';
