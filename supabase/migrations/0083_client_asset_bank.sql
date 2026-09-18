-- 0083 — Per-client asset bank kinds (photo, b-roll)
--
-- Extends existing client_assets (already per-client, not per-idea).
-- Pipeline raw/source footage stays in content_idea_videos and is not
-- touched by this bank. Bytes for new bank uploads live under the R2
-- prefix client-assets/{clientId}/… (never ideas/).

alter table public.client_assets
  drop constraint if exists client_assets_kind_check;

alter table public.client_assets
  add constraint client_assets_kind_check
  check (kind in (
    'logo',
    'color_guide',
    'font',
    'legal',
    'contract',
    'other',
    'photo',
    'broll'
  ));

comment on table public.client_assets is
  'Brand kit + permanent client asset bank (logo, photo, b-roll, other). Additive; never stores pipeline raw.';

notify pgrst, 'reload schema';
