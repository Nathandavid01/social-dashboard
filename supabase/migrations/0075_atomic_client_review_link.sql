-- STAGED: apply and verify in Nathan's Supabase before switching the action to this RPC.
-- Invoker rights retain RLS. p_request_id must be reused on transport retries.
create or replace function public.replace_client_review_link(
 p_client_id uuid, p_idea_ids uuid[], p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 actor uuid := auth.uid();
 ids uuid[];
 previous_ids uuid[];
 existing public.entregas_client_reviews%rowtype;
 new_token uuid;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and status='active' and role::text in ('owner','supervisor','editor','copy')) then
  raise exception 'No autorizado para generar enlaces' using errcode='42501';
 end if;
 select array_agg(distinct id order by id) into ids from unnest(p_idea_ids) id;
 if p_request_id is null or coalesce(cardinality(ids),0)=0 or array_position(ids,null) is not null then
  raise exception 'Selecciona videos válidos' using errcode='22023';
 end if;
 -- Serialize link replacements for one client, including overlapping idea sets.
 perform 1 from public.clients where id=p_client_id for update;
 if not found then raise exception 'Cliente no disponible' using errcode='22023';end if;
 select * into existing from public.entregas_client_reviews where id=p_request_id;
 if found then
  if existing.client_id<>p_client_id or existing.created_by is distinct from actor
   or existing.expires_at<=now()
   or (select array_agg(idea_id order by idea_id) from public.entregas_client_review_items where review_id=p_request_id) is distinct from ids then
   raise exception 'La solicitud ya no corresponde a este enlace' using errcode='22023';
  end if;
  return jsonb_build_object('token',existing.token);
 end if;
 perform 1 from public.content_ideas where id=any(ids) order by id for update;
 if (select count(*) from public.content_ideas where id=any(ids) and client_id=p_client_id and status<>'descartada')<>cardinality(ids) then
  raise exception 'Todos los videos deben pertenecer al cliente' using errcode='22023';
 end if;
 perform 1 from public.content_idea_videos where idea_id=any(ids) and kind='edited'
  and storage_provider='entregas-r2' and (status is null or status not in ('archived','failed')) for share;
 if exists(select 1 from unnest(ids) i where not exists(select 1 from public.content_idea_videos v
  where v.idea_id=i and v.kind='edited' and v.storage_provider='entregas-r2'
   and (v.status is null or v.status not in ('archived','failed')))) then
  raise exception 'Cada video necesita un archivo editado disponible' using errcode='22023';
 end if;
 select array_agg(distinct review_id) into previous_ids from public.entregas_client_review_items where idea_id=any(ids);
 insert into public.entregas_client_reviews(id,client_id,expires_at,created_by)
 values(p_request_id,p_client_id,now()+interval '7 days',actor) returning token into new_token;
 insert into public.entregas_client_review_items(review_id,idea_id)
 select p_request_id,id from unnest(ids) id;
 -- Remove only selected videos; other videos in legacy shared links survive.
 delete from public.entregas_client_review_items where idea_id=any(ids) and review_id=any(previous_ids);
 -- Keep empty parents as expired request tombstones: replay must not recreate them.
 update public.entregas_client_reviews r set expires_at=now()
 where r.id=any(previous_ids) and not exists(select 1 from public.entregas_client_review_items i where i.review_id=r.id);
 return jsonb_build_object('token',new_token);
end;
$$;
revoke all on function public.replace_client_review_link(uuid,uuid[],uuid) from public;
grant execute on function public.replace_client_review_link(uuid,uuid[],uuid) to authenticated;
