-- ============================================================
-- Migration 0010: Two-stage Video QC workflow
-- ============================================================
-- Adds intermediate review states:
--   submitted             → in queue (Pendientes badge)
--   head_editor_review    → Head Editor is reviewing
--   pending_final_check   → passed head editor, awaiting Final Check
--   final_check_review    → Final reviewer is reviewing
--   revision_needed       → sent back to editor
--   approved              → passed both stages, ready to post

-- Migrate any existing 'in_review' rows to 'head_editor_review' first,
-- BEFORE swapping the check constraint.
update public.video_reviews
   set status = 'head_editor_review'
 where status = 'in_review';

-- Drop the old check constraint and add the new one
alter table public.video_reviews
  drop constraint if exists video_reviews_status_check;

alter table public.video_reviews
  add constraint video_reviews_status_check
  check (status in (
    'submitted',
    'head_editor_review',
    'pending_final_check',
    'final_check_review',
    'revision_needed',
    'approved'
  ));

-- Add a column to track who approved at each stage (audit trail)
alter table public.video_reviews
  add column if not exists head_editor_id     uuid references public.profiles(id) on delete set null;
alter table public.video_reviews
  add column if not exists final_reviewer_id  uuid references public.profiles(id) on delete set null;
alter table public.video_reviews
  add column if not exists head_editor_approved_at  timestamptz;
alter table public.video_reviews
  add column if not exists final_approved_at        timestamptz;

notify pgrst, 'reload schema';
