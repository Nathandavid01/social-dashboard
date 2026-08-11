-- ============================================================
-- Migration 0059: borradores de "Escribir ideas"
-- ============================================================
-- La tabla de escribir ideas vivía en estado local del navegador: cambiar de
-- cliente no la reiniciaba, así que lo tecleado para un cliente acababa
-- guardado en OTRO. Ahora lo tecleado se persiste por (persona, cliente) hasta
-- que se envía de verdad como content_ideas.
--
-- Un borrador por persona y cliente: dos personas escribiendo ideas del mismo
-- cliente no se pisan.

create table if not exists public.idea_drafts (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  -- Las filas tal cual se teclean. jsonb y no columnas: es un borrador, su
  -- forma la manda el formulario y cambia sin migración.
  rows        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index if not exists idea_drafts_user_idx on public.idea_drafts (user_id, updated_at desc);

alter table public.idea_drafts enable row level security;

-- Cada quien ve y escribe SOLO su borrador. No es dato compartido: es lo que
-- alguien tiene a medio escribir.
drop policy if exists "idea_drafts: propio read"   on public.idea_drafts;
drop policy if exists "idea_drafts: propio write"  on public.idea_drafts;
drop policy if exists "idea_drafts: propio update" on public.idea_drafts;
drop policy if exists "idea_drafts: propio delete" on public.idea_drafts;

create policy "idea_drafts: propio read"
  on public.idea_drafts for select to authenticated
  using (user_id = auth.uid());

create policy "idea_drafts: propio write"
  on public.idea_drafts for insert to authenticated
  with check (user_id = auth.uid());

create policy "idea_drafts: propio update"
  on public.idea_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "idea_drafts: propio delete"
  on public.idea_drafts for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists trg_idea_drafts_updated_at on public.idea_drafts;
create trigger trg_idea_drafts_updated_at
  before update on public.idea_drafts
  for each row execute function public.set_updated_at();
