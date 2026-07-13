-- 0044 — Approving is FINAL (v2.96)
--
-- Product decision (Eric, 2026-07-13): once the client approves, they cannot
-- change their vote. The reason is physical, not bureaucratic: approving
-- SCHEDULES the video in Metricool, and flipping to "rejected" afterwards does
-- NOT pull it back down. Offering a change we can't honor is a lie in the UI.
-- If they need a change after approving, they comment and the staff acts.
--
-- Rejecting stays reversible: a rejected video is still in the agency's hands,
-- so the client changing their mind to "approved" must still publish it.
--
-- Enforced HERE, in the RPC, not just in the portal — the buttons are a
-- courtesy; this is the rule. Builds on 0043 (which added `for update`, so the
-- check below can't be raced by two simultaneous votes).
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

  -- The lock: an approval is final. Re-sending the SAME 'approved' vote is a
  -- harmless no-op (a double-click, a refresh) — don't punish it with an error;
  -- just report the state. Trying to UNDO it is what we refuse.
  if v_idea.client_review_status = 'approved' then
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
