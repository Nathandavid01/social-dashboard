-- ============================================================
-- Migration 0072: generated_graphics table
-- ============================================================
-- Persists AI-generated graphics (Grok Imagine) so the team can
-- revisit, reuse and download past artes per client. The image
-- bytes live in the public `client-assets` storage bucket under
-- generated-graphics/<client_id>/…; this table is the index.

create table if not exists public.generated_graphics (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid references public.clients(id) on delete set null,
  generated_by  uuid references public.profiles(id) on delete set null,
  -- What the team asked for, in their words (shown in history).
  concept       text not null,
  -- The full prompt sent to the model (debugging / reproducibility).
  prompt        text,
  aspect_ratio  text not null default '1:1',
  model         text,
  image_url     text not null,
  storage_path  text,
  -- Foto propia del equipo usada como base (image-to-image), si la hubo.
  source_image_url text,
  created_at    timestamptz not null default now()
);

create index if not exists generated_graphics_client_idx  on public.generated_graphics (client_id);
create index if not exists generated_graphics_created_idx on public.generated_graphics (created_at desc);

alter table public.generated_graphics enable row level security;

drop policy if exists "generated_graphics: authenticated read"   on public.generated_graphics;
drop policy if exists "generated_graphics: authenticated insert" on public.generated_graphics;
drop policy if exists "generated_graphics: authenticated update" on public.generated_graphics;
drop policy if exists "generated_graphics: authenticated delete" on public.generated_graphics;
create policy "generated_graphics: authenticated read"   on public.generated_graphics for select to authenticated using (true);
create policy "generated_graphics: authenticated insert" on public.generated_graphics for insert to authenticated with check (true);
create policy "generated_graphics: authenticated update" on public.generated_graphics for update to authenticated using (true) with check (true);
create policy "generated_graphics: authenticated delete" on public.generated_graphics for delete to authenticated using (true);

notify pgrst, 'reload schema';
