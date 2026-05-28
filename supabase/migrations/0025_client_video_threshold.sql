-- Migration 0025: per-client video buffer threshold
-- The minimum number of recorded videos (content_ideas status 'grabada')
-- a client should keep in buffer. When the accumulated count drops below
-- this, the team is notified that recording is needed.
alter table public.clients
  add column if not exists video_threshold int not null default 0;
notify pgrst, 'reload schema';
