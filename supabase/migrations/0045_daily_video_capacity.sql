-- 0045 — Per-person daily video capacity (v2.97, "Mi día")
--
-- How many videos this person can take in a day. There was NO notion of
-- per-person load anywhere in the app — that's the gap that kept the team in
-- ClickUp. "Mi día" uses this to say "estás sobre tu tope" instead of just
-- listing work forever.
--
-- Deliberately configurable per person (Eric, 2026-07-13): an editor and a
-- videographer don't absorb the same amount, and it changes as people ramp up.
--
-- NULL = no ceiling set → the screen still works, it just never warns. That's the
-- safe default: we do NOT invent a number for someone.
-- 0 is meaningful and distinct from NULL: "take nothing today" (out sick, on
-- another project). The app compares against null explicitly so 0 survives.
alter table public.profiles
  add column if not exists daily_video_capacity smallint
    check (daily_video_capacity is null or daily_video_capacity between 0 and 50);

comment on column public.profiles.daily_video_capacity is
  'Videos per day this person can take. NULL = no ceiling configured; 0 = none today.';
