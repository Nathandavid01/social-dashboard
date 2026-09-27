-- A staff approval in Recibo applies only to the exact edited file shown.
-- Existing unpinned marks require a fresh review; never attach them to a newer cut.
alter table public.content_ideas
  add column if not exists staff_client_approved_video_id uuid null
    references public.content_idea_videos(id) on delete set null;

comment on column public.content_ideas.staff_client_approved_video_id is
  'Exact Entregas edited file that staff marked client-approved in Recibo.';
