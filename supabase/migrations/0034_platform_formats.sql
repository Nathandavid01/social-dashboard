-- 0034_platform_formats.sql
-- Format per network for a content idea.
--
-- "Caption único" gives one caption for all networks; the FORMAT, however, can
-- differ per network (a Reel on Instagram, a Video on TikTok). We store that as
-- a jsonb map { network: formatValue }, e.g. {"instagram":"reel","tiktok":"video"}.
-- The PRESENCE of a network key means the video is meant for that network; the
-- value is the chosen format. This does NOT change where a video publishes
-- (that still comes from the client's connected networks) — only the format.
--
-- Additive + safe: nullable-with-default, no backfill needed.

alter table content_ideas
  add column if not exists platform_formats jsonb not null default '{}'::jsonb;

comment on column content_ideas.platform_formats is
  'Per-network post format, e.g. {"instagram":"reel","tiktok":"video"}. Presence of a network key = that network is selected for this video.';
