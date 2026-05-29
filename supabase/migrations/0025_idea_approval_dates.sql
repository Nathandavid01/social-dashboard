-- Migration 0025: approval status + recording/publish dates on content_ideas
-- Adds per-idea approval lifecycle (pending -> submitted -> approved/revision_needed)
-- and scheduling dates. Approval columns are written only via gated server actions.
alter table public.content_ideas
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'submitted', 'approved', 'revision_needed')),
  add column if not exists approved_by      uuid references public.profiles(id),
  add column if not exists approved_at       timestamptz,
  add column if not exists submitted_at      timestamptz,
  add column if not exists recording_date    date,
  add column if not exists publish_date      date;

notify pgrst, 'reload schema';
