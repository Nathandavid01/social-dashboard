-- STAGED until applied to Nathan Supabase and verified with the real schema.
create or replace function public.submit_entregas_review(
  p_token    uuid,
  p_idea_id  uuid,
  p_decision text,
  p_comment  text,
  p_name     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.entregas_client_reviews%rowtype;
  it public.entregas_client_review_items%rowtype;
  idea public.content_ideas%rowtype;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'decision_invalida');
  end if;

  select * into r from public.entregas_client_reviews where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_desconocido');
  end if;
  if r.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencido');
  end if;

  -- Same idea lock used by posting/review updates; do not return a sent video.
  select * into idea from public.content_ideas i where i.id=p_idea_id
    and exists(select 1 from public.entregas_client_review_items x where x.review_id=r.id and x.idea_id=i.id)
    for update;
  if not found then
    return jsonb_build_object('ok',false,'error','video_no_es_de_este_enlace');
  end if;

  select * into it from public.entregas_client_review_items
   where review_id = r.id and idea_id = p_idea_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'video_no_es_de_este_enlace');
  end if;
  if it.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ya_votado', 'status', it.status);
  end if;
  if idea.metricool_post_id is not null or idea.posted_at is not null
     or idea.published_at is not null or idea.posting_started_at is not null
     or idea.status in ('publicada','descartada') then
    return jsonb_build_object('ok',false,'error','video_ya_enviado');
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_comment), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'falta_comentario');
  end if;

  update public.entregas_client_review_items
     set status = p_decision,
         comment = nullif(btrim(p_comment), ''),
         reviewer_name = nullif(btrim(p_name), ''),
         decided_at = now()
   where id = it.id;

  -- Rechazar devuelve el video al editor, en la misma operación: si esto se
  -- quedara para una segunda llamada, un fallo de red dejaría el voto guardado
  -- y la tarjeta sin volver.
  if p_decision = 'rejected' then
    update public.content_ideas
       set approval_status = 'revision_needed'
     where id = p_idea_id;

    insert into public.content_idea_activity (content_idea_id, user_id, action, metadata)
    values (
      p_idea_id, null, 'client_requested_changes',
      jsonb_build_object('note', btrim(p_comment), 'cliente', coalesce(nullif(btrim(p_name), ''), 'Cliente'))
    );
  end if;

  return jsonb_build_object('ok', true, 'idea_id', p_idea_id, 'status', p_decision);
end;
$$;

revoke all on function public.submit_entregas_review(uuid,uuid,text,text,text) from public;
grant execute on function public.submit_entregas_review(uuid,uuid,text,text,text) to anon,authenticated;
