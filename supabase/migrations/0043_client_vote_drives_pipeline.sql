-- 0043 — The client's vote drives the pipeline (v2.95)
--
-- Two things, both needed for the vote→auto-post flow to be correct in prod:
--   a) Serialize submit_client_review so concurrent votes can't both report
--      `changed: true` (the app uses `changed` to fire the auto-post exactly once).
--   b) Backfill the videos whose review link is ALREADY out with a client — they
--      sit at approval_status='pending', and the new logic only acts on videos
--      the staff actually sent. Without this, every link minted before v2.95
--      would be inert: the client votes and nothing happens.

-- ── a) Lock the row before deciding whether the vote changed ──────────────────
--
-- The original read (0042) was a plain SELECT: two votes landing together both
-- read the OLD client_review_status, both compute `changed = true`, and the app
-- fires notify + auto-post twice. `for update` makes the second one wait and
-- re-read the row the first one committed, so it correctly sees `changed = false`.
-- Everything else is byte-for-byte the 0042 body.
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

-- ── b) Adopt the links that are already in clients' hands ─────────────────────
--
-- Sending the review link IS submitting the video for review; from v2.95 on,
-- generateReviewLink records that. These rows predate it. Only touch videos with
-- a LIVE (unexpired) token still sitting at 'pending' — never reopen an approved
-- one, never touch a video that was never sent.
update public.content_ideas
   set approval_status = 'submitted',
       submitted_at = coalesce(submitted_at, now())
 where review_token is not null
   and coalesce(approval_status, 'pending') = 'pending'
   and (review_token_expires_at is null or review_token_expires_at > now());
