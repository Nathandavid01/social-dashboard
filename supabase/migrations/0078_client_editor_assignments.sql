-- Apply independently of staged 0074–0077. No second idea/video FK.
begin;
create table if not exists public.client_editor_assignments (
 client_id uuid not null references public.clients(id) on delete cascade,
 editor_id uuid not null references public.profiles(id) on delete cascade,
 assigned_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 primary key(client_id,editor_id)
);
create index if not exists client_editor_assignments_editor_idx on public.client_editor_assignments(editor_id);
alter table public.client_editor_assignments enable row level security;
grant select on public.client_editor_assignments to authenticated;
drop policy if exists "editor assignments read" on public.client_editor_assignments;
create policy "editor assignments read" on public.client_editor_assignments for select to authenticated using (
 editor_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','supervisor'))
);
insert into public.client_editor_assignments(client_id,editor_id)
 select id,assigned_to from public.clients where assigned_to is not null on conflict do nothing;
-- Additional editors can read their client and its ideas/media under existing RLS.
drop policy if exists "clients additional editor read" on public.clients;
create policy "clients additional editor read" on public.clients for select to authenticated using (
 exists(select 1 from public.client_editor_assignments a where a.client_id=clients.id and a.editor_id=auth.uid())
);
drop policy if exists "ideas additional editor read" on public.content_ideas;
create policy "ideas additional editor read" on public.content_ideas for select to authenticated using (
 exists(select 1 from public.client_editor_assignments a where a.client_id=content_ideas.client_id and a.editor_id=auth.uid())
);
drop policy if exists "videos additional editor read" on public.content_idea_videos;
create policy "videos additional editor read" on public.content_idea_videos for select to authenticated using (
 exists(select 1 from public.content_ideas i join public.client_editor_assignments a on a.client_id=i.client_id where i.id=content_idea_videos.idea_id and a.editor_id=auth.uid())
);
create or replace function public.set_recording_client_editors(p_session_id uuid,p_client_id uuid,p_editor_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); previous_client uuid; primary_editor uuid; ids uuid[];
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role::text in ('owner','supervisor') and status='active' and approval_status='approved') then
  raise exception 'Solo Un Administrador O Supervisor Puede Asignar Editores' using errcode='42501';
 end if;
 select array_agg(distinct id order by id) into ids from unnest(p_editor_ids) id;
 if coalesce(cardinality(ids),0)=0 or array_position(ids,null) is not null then raise exception 'Selecciona Al Menos Un Editor' using errcode='22023';end if;
 select client_id into previous_client from public.recording_sessions where id=p_session_id for update;
 if not found then raise exception 'Sesión No Disponible' using errcode='22023';end if;
 if previous_client is not null and previous_client<>p_client_id then raise exception 'La Sesión Ya Pertenece A Otro Cliente' using errcode='22023';end if;
 select assigned_to into primary_editor from public.clients where id=p_client_id for update;
 if not found then raise exception 'Cliente No Disponible' using errcode='22023';end if;
 perform 1 from public.profiles where id=any(ids) for share;
 if (select count(*) from public.profiles where id=any(ids) and role::text='editor' and status='active' and approval_status='approved')<>cardinality(ids) then
  raise exception 'Selecciona Editores Activos Y Aprobados' using errcode='22023';end if;
 if exists(select 1 from public.content_ideas where recording_session_id=p_session_id and client_id is distinct from p_client_id) then
  raise exception 'La Sesión Contiene Ideas De Otro Cliente' using errcode='22023';end if;
 if primary_editor is null or not(primary_editor=any(ids)) then primary_editor:=ids[1];end if;
 insert into public.client_editor_assignments(client_id,editor_id,assigned_by) select p_client_id,id,actor from unnest(ids) id on conflict do nothing;
 delete from public.client_editor_assignments where client_id=p_client_id and not(editor_id=any(ids));
 update public.clients set assigned_to=primary_editor,assignment_changed_by=actor,assignment_changed_at=now() where id=p_client_id;
 update public.recording_sessions set client_id=p_client_id where id=p_session_id;
 return jsonb_build_object('ok',true,'client_id',p_client_id,'editor_ids',ids);
end$$;
revoke all on function public.set_recording_client_editors(uuid,uuid,uuid[]) from public;
grant execute on function public.set_recording_client_editors(uuid,uuid,uuid[]) to authenticated;
-- Keep the existing single-editor assignment screens consistent with membership.
create or replace function public.sync_primary_client_editor()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and old.assigned_to is distinct from new.assigned_to and old.assigned_to is not null then
  delete from public.client_editor_assignments where client_id=new.id and editor_id=old.assigned_to;
 end if;
 if new.assigned_to is not null then
  insert into public.client_editor_assignments(client_id,editor_id,assigned_by)
  values(new.id,new.assigned_to,auth.uid()) on conflict do nothing;
 end if;
 return new;
end$$;
drop trigger if exists sync_primary_client_editor on public.clients;
create trigger sync_primary_client_editor after insert or update of assigned_to on public.clients
 for each row execute function public.sync_primary_client_editor();
commit;
