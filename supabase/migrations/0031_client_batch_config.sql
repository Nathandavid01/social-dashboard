-- Per-client batch configuration, editable from the Lote de videos summary.
--   batch_label      → a name/period for the current batch (e.g. "Junio 2026").
--   videos_per_batch → override for how many videos go in each batch/session.
--                      When null, the count is derived from the posting cadence.
--
-- Safe/idempotent. Code reads these defensively (falls back when absent), so the
-- app keeps working before this migration is applied; applying it just enables
-- the editable LOTE + cantidad fields.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS batch_label text,
  ADD COLUMN IF NOT EXISTS videos_per_batch int
    CHECK (videos_per_batch IS NULL OR videos_per_batch BETWEEN 1 AND 60);

COMMENT ON COLUMN public.clients.batch_label IS
  'Optional name/period for the client''s current batch (shown as LOTE in the Lote de videos view).';
COMMENT ON COLUMN public.clients.videos_per_batch IS
  'Optional override for videos per batch/session. When null, derived from posting cadence.';
