-- STAGED: v2 RPCs are not called until Nathan deployment and authenticated verification.
-- Requires 0071. Existing RPCs remain unchanged during coordinated rollout.
-- STAGED until applied to Nathan Supabase and verified with the real schema.
create or replace function public.submit_entregas_review_v2(
  p_token    uuid,
  p_idea_id  uuid,
  p_decision text,
  p_comment  text,
  p_name     text,
  p_video_file_id uuid
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
  current_file uuid;
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

  -- Lock available media against archival while sealing the exact displayed file.
  perform 1 from public.content_idea_videos v where v.idea_id=p_idea_id
    and v.kind='edited' and v.storage_provider='entregas-r2' for share;
  select v.id into current_file from public.content_idea_videos v
    where v.idea_id=p_idea_id and v.kind='edited' and v.storage_provider='entregas-r2'
      and (v.status is null or v.status not in ('failed','archived'))
      and nullif(btrim(v.drive_file_id),'') is not null
    order by v.uploaded_at desc nulls last,v.id desc limit 1;
  if p_video_file_id is null or current_file is distinct from p_video_file_id then
    return jsonb_build_object('ok',false,'error','video_cambio');
  end if;

  update public.entregas_client_review_items
     set video_file_id = p_video_file_id,
         status = p_decision,
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

revoke all on function public.submit_entregas_review_v2(uuid,uuid,text,text,text,uuid) from public;
grant execute on function public.submit_entregas_review_v2(uuid,uuid,text,text,text,uuid) to anon,authenticated;

create or replace function public.get_entregas_review_v2(p_token uuid)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('review_id',r.id,'client_name',c.name,'expires_at',r.expires_at,
  'videos',coalesce((select jsonb_agg(jsonb_build_object(
   'idea_id',it.idea_id,'titulo',ci.title,'status',it.status,'comment',it.comment,
   'reviewer_name',it.reviewer_name,'video_file_id',media.id,'video_key',media.drive_file_id
  ) order by it.created_at,it.id)
  from public.entregas_client_review_items it
  join public.content_ideas ci on ci.id=it.idea_id
  left join lateral (
   select v.id,v.drive_file_id from public.content_idea_videos v
   where v.idea_id=it.idea_id and v.kind='edited' and v.storage_provider='entregas-r2'
    and (v.status is null or v.status not in ('failed','archived'))
    and nullif(btrim(v.drive_file_id),'') is not null
    -- Historical votes never silently display a later file. Legacy unsealed votes return no media.
    and (it.status='pending' or v.id=it.video_file_id)
   order by v.uploaded_at desc nulls last,v.id desc limit 1
  ) media on true
  where it.review_id=r.id),'[]'::jsonb))
 from public.entregas_client_reviews r left join public.clients c on c.id=r.client_id
 where r.token=p_token;
$$;
revoke all on function public.get_entregas_review_v2(uuid) from public;
grant execute on function public.get_entregas_review_v2(uuid) to anon,authenticated;
