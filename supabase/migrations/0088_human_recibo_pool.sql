-- Puente Recibo humano → pool Listo.
-- Explicit staff opt-in. Never automatic for human videos.
-- Gate (app-enforced, documented): Revisión approval_status='approved'
-- + client approval. AI Recibo ignores this column (auto Listo).

alter table public.content_ideas
  add column if not exists staff_pool_ready boolean not null default false;

comment on column public.content_ideas.staff_pool_ready is
  'Explicit staff CTA: send an approved human Recibo/Entregas cut to the client pool as Listo. Never automatic. Requires Revisión (approval_status=approved) and client approval. AI Recibo ignores this (auto Listo).';
