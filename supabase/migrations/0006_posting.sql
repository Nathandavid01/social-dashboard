-- ============================================================
-- POSTING FLOW
-- Adds default_platforms to clients and posting_drafts table
-- so approved videos can be scheduled as Metricool drafts.
-- ============================================================

-- Default platforms a client posts to (instagram, facebook, tiktok, ...)
alter table public.clients
  add column if not exists default_platforms text[] not null default '{instagram,facebook}';

-- ============================================================
-- POSTING_DRAFTS
-- One row per draft we've pushed to Metricool from an approved video
-- ============================================================
create table if not exists public.posting_drafts (
  id                  uuid primary key default uuid_generate_v4(),
  video_review_id     uuid not null references public.video_reviews(id) on delete cascade,
  client_id           uuid references public.clients(id) on delete set null,
  scheduled_for       timestamptz not null,
  caption             text not null,
  platforms           text[] not null default '{}',
  metricool_post_id   bigint,
  metricool_uuid      text,
  status              text not null default 'sent',
  error_message       text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.posting_drafts
  add constraint posting_drafts_status_check
  check (status in ('sent', 'failed'));

create index if not exists posting_drafts_video_review_idx
  on public.posting_drafts (video_review_id);
create index if not exists posting_drafts_client_idx
  on public.posting_drafts (client_id);
create index if not exists posting_drafts_scheduled_idx
  on public.posting_drafts (scheduled_for desc);

alter table public.posting_drafts enable row level security;

create policy "posting_drafts: authenticated read"
  on public.posting_drafts for select
  to authenticated using (true);

create policy "posting_drafts: authenticated insert"
  on public.posting_drafts for insert
  to authenticated with check (true);

create policy "posting_drafts: authenticated update"
  on public.posting_drafts for update
  to authenticated using (true) with check (true);

create policy "posting_drafts: authenticated delete"
  on public.posting_drafts for delete
  to authenticated using (true);

create or replace function public.set_posting_drafts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_posting_drafts_updated_at
  before update on public.posting_drafts
  for each row execute function public.set_posting_drafts_updated_at();
