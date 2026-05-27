-- ============================================================
-- Migration 0009: content_ideas
-- AI-generated content ideas linked to clients and production tasks.
-- Closes the loop: idea → assigned → produced → published.
-- ============================================================

create table if not exists public.content_ideas (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  content_type        text not null check (content_type in ('R', 'P', 'C', 'S')),  -- Reel, Post, Carousel, Story
  title               text not null,
  hook                text,
  visual_brief        text,                -- For designers/editors: visual concept, shots, colors
  caption_angle       text,                -- For copywriters: tone, hook, CTA direction
  hashtags_suggestion text,
  rationale           text,                -- Why this idea fits the client (helps team trust the suggestion)
  status              text not null default 'idea' check (status in ('idea', 'asignada', 'producida', 'publicada', 'descartada')),
  production_task_id  uuid references public.production_tasks(id) on delete set null,
  theme               text,                -- Optional theme used to generate (e.g. "lanzamiento", "behind-the-scenes")
  generation_prompt   text,                -- The brief user typed (for re-generation)
  model               text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_ideas_client_idx on public.content_ideas (client_id);
create index if not exists content_ideas_status_idx on public.content_ideas (status);
create index if not exists content_ideas_production_task_idx on public.content_ideas (production_task_id);
create index if not exists content_ideas_created_idx on public.content_ideas (created_at desc);

-- Link from production_tasks back to ideas (one task can come from one idea)
alter table public.production_tasks
  add column if not exists idea_id uuid references public.content_ideas(id) on delete set null;

alter table public.content_ideas enable row level security;

drop policy if exists "content_ideas: authenticated read"   on public.content_ideas;
drop policy if exists "content_ideas: authenticated insert" on public.content_ideas;
drop policy if exists "content_ideas: authenticated update" on public.content_ideas;
drop policy if exists "content_ideas: authenticated delete" on public.content_ideas;
create policy "content_ideas: authenticated read"   on public.content_ideas for select to authenticated using (true);
create policy "content_ideas: authenticated insert" on public.content_ideas for insert to authenticated with check (true);
create policy "content_ideas: authenticated update" on public.content_ideas for update to authenticated using (true) with check (true);
create policy "content_ideas: authenticated delete" on public.content_ideas for delete to authenticated using (true);

drop trigger if exists set_content_ideas_updated_at on public.content_ideas;
create trigger set_content_ideas_updated_at
  before update on public.content_ideas
  for each row execute function public.set_updated_at();

-- Auto-update idea status when linked production_task status changes
create or replace function public.sync_idea_status_from_task()
returns trigger language plpgsql as $$
begin
  if new.idea_id is null then return new; end if;
  if new.status = 'publicado' then
    update public.content_ideas set status = 'publicada' where id = new.idea_id;
  elsif new.status in ('en_edicion', 'en_revision', 'revisiones', 'aprobado') then
    update public.content_ideas
       set status = case when status = 'idea' then 'producida' else status end
     where id = new.idea_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_idea_status on public.production_tasks;
create trigger trg_sync_idea_status
  after update of status on public.production_tasks
  for each row execute function public.sync_idea_status_from_task();

notify pgrst, 'reload schema';
