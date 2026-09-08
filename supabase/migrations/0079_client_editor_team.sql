-- Requires 0078. Assign a client team without creating or changing any recording.
begin;
create or replace function public.set_client_editors(p_client_id uuid,p_editor_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); primary_editor uuid; ids uuid[];
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role::text in ('owner','supervisor') and status='active' and approval_status='approved') then
  raise exception 'Solo Un Administrador O Supervisor Puede Asignar Editores' using errcode='42501';
 end if;
 select array_agg(distinct id order by id) into ids from unnest(p_editor_ids) id;
 if coalesce(cardinality(ids),0)=0 or array_position(ids,null) is not null then raise exception 'Selecciona Al Menos Un Editor' using errcode='22023';end if;
 select assigned_to into primary_editor from public.clients where id=p_client_id for update;
 if not found then raise exception 'Cliente No Disponible' using errcode='22023';end if;
 perform 1 from public.profiles where id=any(ids) for share;
 if (select count(*) from public.profiles where id=any(ids) and role::text='editor' and status='active' and approval_status='approved')<>cardinality(ids) then
  raise exception 'Selecciona Editores Activos Y Aprobados' using errcode='22023';end if;
 if primary_editor is null or not(primary_editor=any(ids)) then primary_editor:=ids[1];end if;
 insert into public.client_editor_assignments(client_id,editor_id,assigned_by) select p_client_id,id,actor from unnest(ids) id on conflict do nothing;
 delete from public.client_editor_assignments where client_id=p_client_id and not(editor_id=any(ids));
 update public.clients set assigned_to=primary_editor,assignment_changed_by=actor,assignment_changed_at=now() where id=p_client_id;
 return jsonb_build_object('ok',true,'client_id',p_client_id,'editor_ids',ids);
end$$;
revoke all on function public.set_client_editors(uuid,uuid[]) from public;
grant execute on function public.set_client_editors(uuid,uuid[]) to authenticated;
commit;
