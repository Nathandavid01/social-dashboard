-- Planned videos to record when a session is scheduled (synced from pipeline Video column).
alter table public.recording_sessions
  add column if not exists planned_video_count int not null default 0;

notify pgrst, 'reload schema';
