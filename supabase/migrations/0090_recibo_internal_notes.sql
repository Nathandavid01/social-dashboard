-- Recibo internal QC notes. Staff-only reasons a cut does not work.
-- NEVER expose via get_review_by_token, get_entregas_review, or any anon RPC.
-- The client portal reads video_review_comments / entregas_client_review_items only.

create table if not exists public.recibo_internal_notes (
  id               uuid primary key default gen_random_uuid(),
  content_idea_id  uuid not null references public.content_ideas(id) on delete cascade,
  author_id        uuid references public.profiles(id) on delete set null,
  author_name      text not null,
  body             text not null check (length(trim(body)) > 0),
  created_at       timestamptz not null default now()
);

comment on table public.recibo_internal_notes is
  'INTERNAL ONLY. Recibo staff reasons a cut does not work. Do not grant to anon or fold into client review RPCs.';

create index if not exists recibo_internal_notes_idea_idx
  on public.recibo_internal_notes (content_idea_id, created_at);

alter table public.recibo_internal_notes enable row level security;

drop policy if exists "recibo_internal_notes: authenticated read" on public.recibo_internal_notes;
create policy "recibo_internal_notes: authenticated read"
  on public.recibo_internal_notes for select to authenticated using (true);

drop policy if exists "recibo_internal_notes: authenticated insert" on public.recibo_internal_notes;
create policy "recibo_internal_notes: authenticated insert"
  on public.recibo_internal_notes for insert to authenticated
  with check (author_id = auth.uid());

revoke all on table public.recibo_internal_notes from anon;
grant select, insert on table public.recibo_internal_notes to authenticated;

notify pgrst, 'reload schema';
