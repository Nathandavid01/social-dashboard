-- ============================================================
-- Migration 0012: Client CRM Profile
-- Extends clients with brand/contact/contract/posting/meeting fields.
-- Adds client_payments (history) and client_assets (brand kit + legal docs).
-- Sets up Supabase Storage buckets for assets and contracts.
-- ============================================================

-- 1. Extend clients with CRM fields
alter table public.clients
  add column if not exists owner_name           text,
  add column if not exists owner_email          text,
  add column if not exists owner_phone          text,
  add column if not exists brand_colors         jsonb not null default '{}'::jsonb,
  -- shape: { "primary": "#3E64DE", "secondary": "...", "accent": "...", "text": "..." }
  add column if not exists logo_url             text,
  add column if not exists logo_dark_url        text,
  add column if not exists posting_days         smallint[] not null default '{}',
  -- 0 = Sunday … 6 = Saturday
  add column if not exists contract_url         text,
  add column if not exists contract_signed_at   date,
  add column if not exists contract_expires_at  date,
  add column if not exists monthly_fee          numeric(10,2),
  add column if not exists last_meeting_at      timestamptz,
  add column if not exists last_meeting_notes   text;

-- 2. client_payments (histórico)
create table if not exists public.client_payments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  amount          numeric(10,2) not null check (amount >= 0),
  paid_at         date not null,
  method          text,
  reference       text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists client_payments_client_idx
  on public.client_payments (client_id, paid_at desc);

alter table public.client_payments enable row level security;

drop policy if exists "client_payments: authenticated read"   on public.client_payments;
drop policy if exists "client_payments: authenticated insert" on public.client_payments;
drop policy if exists "client_payments: authenticated update" on public.client_payments;
drop policy if exists "client_payments: authenticated delete" on public.client_payments;
create policy "client_payments: authenticated read"   on public.client_payments for select to authenticated using (true);
create policy "client_payments: authenticated insert" on public.client_payments for insert to authenticated with check (true);
create policy "client_payments: authenticated update" on public.client_payments for update to authenticated using (true) with check (true);
create policy "client_payments: authenticated delete" on public.client_payments for delete to authenticated using (true);

-- 3. client_assets (brand kit + legal docs)
create table if not exists public.client_assets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  kind            text not null check (kind in ('logo','color_guide','font','legal','contract','other')),
  name            text not null,
  url             text not null,
  storage_path    text,
  size_bytes      bigint,
  mime_type       text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now()
);

create index if not exists client_assets_client_idx
  on public.client_assets (client_id, uploaded_at desc);
create index if not exists client_assets_kind_idx
  on public.client_assets (client_id, kind);

alter table public.client_assets enable row level security;

drop policy if exists "client_assets: authenticated read"   on public.client_assets;
drop policy if exists "client_assets: authenticated insert" on public.client_assets;
drop policy if exists "client_assets: authenticated update" on public.client_assets;
drop policy if exists "client_assets: authenticated delete" on public.client_assets;
create policy "client_assets: authenticated read"   on public.client_assets for select to authenticated using (true);
create policy "client_assets: authenticated insert" on public.client_assets for insert to authenticated with check (true);
create policy "client_assets: authenticated update" on public.client_assets for update to authenticated using (true) with check (true);
create policy "client_assets: authenticated delete" on public.client_assets for delete to authenticated using (true);

-- 4. Storage buckets
insert into storage.buckets (id, name, public)
values
  ('client-assets',    'client-assets',    true),   -- public read so logos render via <img>
  ('client-contracts', 'client-contracts', false)   -- private — auth-only
on conflict (id) do nothing;

-- 4.1 Storage policies — client-assets (public read, auth write/delete)
drop policy if exists "client-assets public read"   on storage.objects;
drop policy if exists "client-assets auth insert"   on storage.objects;
drop policy if exists "client-assets auth update"   on storage.objects;
drop policy if exists "client-assets auth delete"   on storage.objects;
create policy "client-assets public read"   on storage.objects for select to anon, authenticated using (bucket_id = 'client-assets');
create policy "client-assets auth insert"   on storage.objects for insert to authenticated with check (bucket_id = 'client-assets');
create policy "client-assets auth update"   on storage.objects for update to authenticated using (bucket_id = 'client-assets') with check (bucket_id = 'client-assets');
create policy "client-assets auth delete"   on storage.objects for delete to authenticated using (bucket_id = 'client-assets');

-- 4.2 Storage policies — client-contracts (auth-only read+write)
drop policy if exists "client-contracts auth read"   on storage.objects;
drop policy if exists "client-contracts auth insert" on storage.objects;
drop policy if exists "client-contracts auth update" on storage.objects;
drop policy if exists "client-contracts auth delete" on storage.objects;
create policy "client-contracts auth read"   on storage.objects for select to authenticated using (bucket_id = 'client-contracts');
create policy "client-contracts auth insert" on storage.objects for insert to authenticated with check (bucket_id = 'client-contracts');
create policy "client-contracts auth update" on storage.objects for update to authenticated using (bucket_id = 'client-contracts') with check (bucket_id = 'client-contracts');
create policy "client-contracts auth delete" on storage.objects for delete to authenticated using (bucket_id = 'client-contracts');

notify pgrst, 'reload schema';
