-- ============================================================
-- Migration 0084: client_suggestions
-- ============================================================
-- Sugerencias esporádicas del cliente (WhatsApp / mensajes / otro).
-- Entrada manual — no scrape. Visibles en el perfil y en Escribir ideas.

create table if not exists public.client_suggestions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  source text not null default 'whatsapp'
    check (source in ('whatsapp', 'mensaje', 'otro')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_suggestions_client_created_idx
  on public.client_suggestions (client_id, created_at desc);

alter table public.client_suggestions enable row level security;

create policy "client_suggestions: authenticated read"
  on public.client_suggestions for select to authenticated using (true);

create policy "client_suggestions: authenticated insert"
  on public.client_suggestions for insert to authenticated with check (true);

notify pgrst, 'reload schema';
