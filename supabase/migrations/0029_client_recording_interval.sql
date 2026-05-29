-- Per-client recording cadence: how often (in weeks) we go out to record for
-- this client. Drives the Workflow board's "recording window" — only the ideas
-- needed for the next `recording_interval_weeks` are shown per client.
--
-- Safe/idempotent: defaults to 2 weeks. Existing code reads this column
-- defensively (falls back to 2 if absent), so applying this migration simply
-- enables per-client overrides.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS recording_interval_weeks smallint NOT NULL DEFAULT 2
    CHECK (recording_interval_weeks BETWEEN 1 AND 12);

COMMENT ON COLUMN public.clients.recording_interval_weeks IS
  'How many weeks of content we record per session for this client (default 2). Controls the Workflow recording window.';
