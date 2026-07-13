-- 0044 — Approving is FINAL once the video is actually scheduled (v2.96)
--
-- Product decision (Eric, 2026-07-13): the client cannot change their vote after
-- approving. The reason is physical: approving SCHEDULES the video in Metricool,
-- and we do not pull a scheduled post back down — so an "undo" would be a promise
-- we can't keep. They comment instead, and the staff acts.
--
-- The lock is therefore tied to the POST EXISTING, not merely to the vote being
-- 'approved'. Those come apart in real, reachable ways: Metricool is down, the
-- caption is missing, or METRICOOL_AUTOPOST_ON_APPROVAL=false. In every one of
-- those the vote says 'approved' while nothing was ever scheduled — locking there
-- would tell the client "quedó programado" (false) and take away their only lever
-- over a video that is still fully in our hands. `metricool_post_id` / `posted_at`
-- (0032) are precisely the "it really went out" evidence.
--
-- Rejecting stays reversible: a rejected video never left the agency, so a client
-- who changes their mind to 'approved' must still get it published.
--
-- Enforced HERE, in the RPC — the portal's buttons are only a courtesy.
-- Supersedes the function body of 0043 (keeps its `for update`); 0043 must be
-- applied first for its data backfill. DO NOT re-apply 0043 alone afterwards: it
-- would silently restore the un-locked function.

-- ── a) The lock ───────────────────────────────────────────────────────────────
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
  v_scheduled boolean;
begin
  -- `for update` (from 0043): serialize concurrent votes so the `changed` flag
  -- below — which the app uses to fire the auto-post exactly once — can't race.
  select * into v_idea from public.content_ideas where review_token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Link inválido.');
  end if;
  if v_idea.review_token_expires_at is not null and now() >= v_idea.review_token_expires_at then
    return jsonb_build_object('ok', false, 'error', 'Este link de revisión venció.');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'Decisión inválida.');
  end if;

  v_scheduled := v_idea.metricool_post_id is not null or v_idea.posted_at is not null;

  -- The lock: an approval that ALREADY produced a scheduled post is final.
  -- Re-sending the SAME 'approved' vote stays a harmless no-op (a double-click, a
  -- refresh) — don't punish it with an error; just report the state. Trying to
  -- UNDO it is what we refuse.
  if v_idea.client_review_status = 'approved' and v_scheduled then
    if p_decision = 'approved' then
      return jsonb_build_object('ok', true, 'status', 'approved', 'idea_id', v_idea.id, 'changed', false);
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'Ya aprobaste este video y quedó programado para publicarse. Si necesitas un cambio, déjanos un comentario aquí y el equipo lo revisa.'
    );
  end if;

  update public.content_ideas
     set client_review_status = p_decision,
         client_reviewed_at = now(),
         -- preserve the previously captured name if this (re)vote sends a blank
         client_reviewer_name = coalesce(nullif(left(trim(p_name), 120), ''), client_reviewer_name)
   where id = v_idea.id;

  -- Only log when the vote actually changed — a token holder re-submitting the
  -- same decision must not amplify the audit log.
  if v_idea.client_review_status is distinct from p_decision then
    insert into public.content_idea_activity (content_idea_id, client_id, user_id, action, metadata)
    values (v_idea.id, v_idea.client_id, null, 'client_reviewed',
            jsonb_build_object('decision', p_decision, 'reviewer', nullif(left(trim(p_name), 120), '')));
  end if;

  return jsonb_build_object(
    'ok', true, 'status', p_decision, 'idea_id', v_idea.id,
    'changed', (v_idea.client_review_status is distinct from p_decision)
  );
end;
$$;

-- ── b) Tell the portal whether it's really scheduled ──────────────────────────
--
-- So the page can show the lock (and the honest reason) without guessing. Same
-- body as 0042 plus the `scheduled` fact.
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
    -- The video really is queued in Metricool → the vote is locked.
    'scheduled', (ci.metricool_post_id is not null or ci.posted_at is not null),
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
