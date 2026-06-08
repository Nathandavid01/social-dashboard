-- Migration 0034: user-settable DEADLINE (fecha límite) per video.
-- A flexible, user-set due date for when a video's work must be DONE — distinct
-- from production_tasks.deadline (auto-calculated 36h before publish) and from
-- publish_date (when it goes live). Surfaced as an overdue/due-soon badge in the
-- pipeline + batch views. Date-only (no time) on purpose, to stay timezone-safe.
alter table public.content_ideas
  add column if not exists deadline date;

create index if not exists content_ideas_deadline_idx on public.content_ideas (deadline);

notify pgrst, 'reload schema';
