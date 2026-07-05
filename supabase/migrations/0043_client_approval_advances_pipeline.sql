-- ============================================================
-- Migration 0043: client approval advances the internal pipeline
--
-- Previously the client's Aprobar/Rechazar vote landed ONLY in
-- `client_review_status` (firewalled from `approval_status`) — a staff human
-- still had to separately click "Aprobar" internally before the video could
-- auto-post. Per product decision, when the CLIENT approves via the public
-- review link, that now counts as the approval that unblocks the pipeline:
-- `approval_status` advances straight to 'approved' (skipping the internal
-- submitted-review step), stamping `approved_at` (no `approved_by` — no staff
-- profile is involved). The app layer (submitClientReviewAction) reads the new
-- `pipeline_advanced` flag on the RPC result and, when true, fires the
-- best-effort Metricool auto-post so the video goes out on its planned date.
--
-- Rejecting still behaves exactly as before — it only records
-- `client_review_status='rejected'`; a staff member decides what happens next.
-- ============================================================

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
  v_advances boolean;
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

  v_advances := p_decision = 'approved' and v_idea.approval_status is distinct from 'approved';

  update public.content_ideas
     set client_review_status = p_decision,
         client_reviewed_at = now(),
         -- preserve the previously captured name if this (re)vote sends a blank
         client_reviewer_name = coalesce(nullif(left(trim(p_name), 120), ''), client_reviewer_name),
         approval_status = case when v_advances then 'approved' else approval_status end,
         approved_at = case when v_advances then now() else approved_at end
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
    'changed', (v_idea.client_review_status is distinct from p_decision),
    'pipeline_advanced', v_advances
  );
end;
$$;
