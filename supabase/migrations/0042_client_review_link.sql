-- ============================================================
-- Migration 0042: client review link (portal de aprobación)
--
-- Professional-agency review flow: staff generates a per-video review link and
-- sends it (manually, via WhatsApp). The client opens `/review/<token>` with NO
-- login, watches the edited video + caption, and can Aprobar / Rechazar /
-- Comentar in a thread. Two-layer firewall: the client vote lands in
-- `client_review_status` — it NEVER touches `approval_status`; a staff human
-- still does the internal approval and triggers Metricool.
--
-- Security model: the token (a random uuid) IS the bearer credential. All
-- unauthenticated client reads/writes go through SECURITY DEFINER functions
-- keyed by the token, so the scoping (`where review_token = p_token`) is
-- enforced by the database — app code cannot reach another video's row.
-- Tokens expire (default 30 days) and are regenerable by staff.
-- ============================================================

-- 1. Review columns on the video (content_ideas). All nullable / defaulted so
--    existing rows and queries that predate this migration keep working.
alter table public.content_ideas
  add column if not exists review_token uuid,
  add column if not exists review_token_expires_at timestamptz,
  add column if not exists client_review_status text not null default 'pending'
    check (client_review_status in ('pending', 'approved', 'rejected')),
  add column if not exists client_reviewed_at timestamptz,
  add column if not exists client_reviewer_name text;

comment on column public.content_ideas.review_token is
  'Random uuid bearer token for the public /review/<token> link. NULL = no link generated yet.';
comment on column public.content_ideas.client_review_status is
  'The CLIENT vote (pending/approved/rejected). Firewalled from approval_status (the internal staff approval).';

-- One video per token (partial unique — many rows share NULL).
create unique index if not exists content_ideas_review_token_key
  on public.content_ideas (review_token) where review_token is not null;

-- 2. Comment thread. Client comments are inserted by the SECURITY DEFINER RPC
--    (author_kind='client'); staff replies are inserted by authenticated actions.
create table if not exists public.video_review_comments (
  id               uuid primary key default gen_random_uuid(),
  content_idea_id  uuid not null references public.content_ideas(id) on delete cascade,
  author_kind      text not null check (author_kind in ('client', 'staff')),
  author_id        uuid references public.profiles(id) on delete set null,
  author_name      text not null,
  body             text not null check (length(trim(body)) > 0),
  created_at       timestamptz not null default now()
);

create index if not exists video_review_comments_idea_idx
  on public.video_review_comments (content_idea_id, created_at);

alter table public.video_review_comments enable row level security;

-- Authenticated staff can read every comment...
drop policy if exists "video_review_comments: authenticated read" on public.video_review_comments;
create policy "video_review_comments: authenticated read"
  on public.video_review_comments for select to authenticated using (true);

-- ...and insert only their OWN staff replies. Client comments never come through
-- here — they go through add_client_review_comment (definer, bypasses RLS).
drop policy if exists "video_review_comments: staff insert" on public.video_review_comments;
create policy "video_review_comments: staff insert"
  on public.video_review_comments for insert to authenticated
  with check (author_kind = 'staff' and author_id = auth.uid());

-- 3a. Read the review by token (comments included). No expiry gate on READ —
--     the client may still SEE an expired link (read-only); writes are what get
--     blocked. Returns NULL when the token doesn't exist.
create or replace function public.get_review_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'idea_id', ci.id,
    'title', ci.title,
    'content_type', ci.content_type,
    'caption', ci.generated_caption,
    'publish_date', ci.publish_date,
    'client_name', c.name,
    'client_review_status', ci.client_review_status,
    'client_reviewer_name', ci.client_reviewer_name,
    'client_reviewed_at', ci.client_reviewed_at,
    'expires_at', ci.review_token_expires_at,
    'edited_video_key', ev.drive_file_id,
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rc.id,
        'author_kind', rc.author_kind,
        'author_name', rc.author_name,
        'body', rc.body,
        'created_at', rc.created_at
      ) order by rc.created_at)
      from public.video_review_comments rc
      where rc.content_idea_id = ci.id
    ), '[]'::jsonb)
  )
  into v
  from public.content_ideas ci
  join public.clients c on c.id = ci.client_id
  left join lateral (
    select drive_file_id
    from public.content_idea_videos
    where idea_id = ci.id and kind = 'edited' and status <> 'archived'
      and storage_provider = 'r2' and drive_file_id is not null
    order by uploaded_at desc
    limit 1
  ) ev on true
  where ci.review_token = p_token;

  return v; -- NULL when no row matched the token
end;
$$;

-- 3b. Record the client vote (approved | rejected). Firewalled: never writes
--     approval_status. Blocks expired links and invalid decisions. Scoped to the
--     single row that owns the token.
create or replace function public.submit_client_review(
  p_token uuid,
  p_decision text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idea public.content_ideas%rowtype;
begin
  select * into v_idea from public.content_ideas where review_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Link inválido.');
  end if;
  if v_idea.review_token_expires_at is not null and now() >= v_idea.review_token_expires_at then
    return jsonb_build_object('ok', false, 'error', 'Este link de revisión venció.');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Decisión inválida.');
  end if;

  update public.content_ideas
     set client_review_status = p_decision,
         client_reviewed_at = now(),
         client_reviewer_name = nullif(left(trim(p_name), 120), '')
   where id = v_idea.id;

  -- Only log when the vote actually changed — a token holder re-submitting the
  -- same decision must not amplify the audit log.
  if v_idea.client_review_status is distinct from p_decision then
    insert into public.content_idea_activity (content_idea_id, client_id, user_id, action, metadata)
    values (v_idea.id, v_idea.client_id, null, 'client_reviewed',
            jsonb_build_object('decision', p_decision, 'reviewer', nullif(left(trim(p_name), 120), '')));
  end if;

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

-- 3c. Add a CLIENT comment to the thread (forced author_kind='client'). Blocks
--     expired links and empty bodies. Scoped to the token's row.
create or replace function public.add_client_review_comment(
  p_token uuid,
  p_name text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idea public.content_ideas%rowtype;
  v_id uuid;
begin
  select * into v_idea from public.content_ideas where review_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Link inválido.');
  end if;
  if v_idea.review_token_expires_at is not null and now() >= v_idea.review_token_expires_at then
    return jsonb_build_object('ok', false, 'error', 'Este link de revisión venció.');
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El comentario está vacío.');
  end if;

  insert into public.video_review_comments (content_idea_id, author_kind, author_id, author_name, body)
  values (v_idea.id, 'client', null,
          coalesce(nullif(left(trim(p_name), 120), ''), 'Cliente'),
          left(trim(p_body), 4000))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- The public review path uses the anon key + the token (unguessable uuid). The
-- SECURITY DEFINER body is what enforces scoping/expiry, so exposing these to
-- anon is safe and keeps the service-role key out of the public request path.
grant execute on function public.get_review_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_client_review(uuid, text, text) to anon, authenticated;
grant execute on function public.add_client_review_comment(uuid, text, text) to anon, authenticated;

-- Refresh PostgREST's schema cache so the new RPCs are reachable immediately
-- (consistent with 0019/0024/0026).
notify pgrst, 'reload schema';
