-- ============================================================
-- Migration 0044: Agency branding (logo + brand identity)
-- ============================================================
-- Singleton settings so owners can replace the default Nate Media mark
-- with their agency logo, name, tagline, and accent color. Used by
-- sidebar, login, and (later) the iOS staff app.

create table if not exists public.agency_branding (
  id              text primary key default 'global',
  brand_name      text not null default 'Nate Media',
  tagline         text not null default 'Operaciones de contenido',
  -- nate_n | nate_radar | custom
  logo_preset     text not null default 'nate_n'
                  check (logo_preset in ('nate_n', 'nate_radar', 'custom')),
  logo_url        text,
  primary_color   text not null default '#D4A017',
  apply_on_login  boolean not null default true,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,
  constraint agency_branding_singleton check (id = 'global')
);

insert into public.agency_branding (id) values ('global')
  on conflict (id) do nothing;

alter table public.agency_branding enable row level security;

drop policy if exists "agency_branding: read"   on public.agency_branding;
drop policy if exists "agency_branding: update" on public.agency_branding;
create policy "agency_branding: read"
  on public.agency_branding for select to authenticated using (true);
-- Owners only (same gate as workflow_settings)
create policy "agency_branding: update"
  on public.agency_branding for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner'));

-- Public bucket for the agency logo (sidebar/login <img src>)
insert into storage.buckets (id, name, public)
values ('agency-branding', 'agency-branding', true)
on conflict (id) do nothing;

drop policy if exists "agency-branding public read"  on storage.objects;
drop policy if exists "agency-branding auth insert"  on storage.objects;
drop policy if exists "agency-branding auth update"  on storage.objects;
drop policy if exists "agency-branding auth delete"  on storage.objects;
create policy "agency-branding public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'agency-branding');
create policy "agency-branding auth insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-branding'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );
create policy "agency-branding auth update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-branding'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    bucket_id = 'agency-branding'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );
create policy "agency-branding auth delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-branding'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

notify pgrst, 'reload schema';
