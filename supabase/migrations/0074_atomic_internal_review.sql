-- Stage only until applied and the server action is switched to this RPC.
-- Invoker rights retain table RLS; role checks also protect direct RPC calls.
create or replace function public.commit_internal_review(
  p_idea_id uuid,
  p_decision text,
  p_video_file_id uuid default null,
  p_note text default null,
  p_captions_verified boolean default false,
  p_video_verified boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  idea public.content_ideas%rowtype;
  video public.content_idea_videos%rowtype;
  next_status text;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id=actor and role::text in ('owner','supervisor') and status='active'
  ) then raise exception 'No autorizado para revisar videos' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approve','request_changes') then
    raise exception 'Decisión no válida' using errcode='22023';
  end if;
  if p_decision='approve' and (p_video_file_id is null or p_captions_verified is not true or p_video_verified is not true) then
    raise exception 'Verifica el video y sus captions antes de aprobar' using errcode='22023';
  end if;
  if p_decision='request_changes' and nullif(btrim(p_note),'') is null then
    raise exception 'Escribe la corrección para el editor' using errcode='22023';
  end if;
  select * into idea from public.content_ideas where id=p_idea_id for update;
  if not found or idea.approval_status <> 'submitted' or idea.status in ('publicada','descartada')
     or idea.metricool_post_id is not null or idea.posted_at is not null or idea.posting_started_at is not null then
    raise exception 'El video cambió o ya tiene un envío. Actualiza la revisión' using errcode='P0002';
  end if;
  if p_video_file_id is not null then
    select * into video from public.content_idea_videos where id=p_video_file_id and idea_id=p_idea_id
      and kind='edited' and storage_provider='entregas-r2' and status not in ('archived','failed') for share;
    if not found then raise exception 'El archivo revisado no está disponible' using errcode='P0002'; end if;
    if coalesce(video.uploaded_by,idea.created_by)=actor then
      raise exception 'No puedes revisar tu propio video' using errcode='42501';
    end if;
  end if;
  next_status := case when p_decision='approve' then 'approved' else 'revision_needed' end;
  update public.content_ideas set approval_status=next_status,
    approved_video_id=case when p_decision='approve' then p_video_file_id else null end,
    approved_by=case when p_decision='approve' then actor else null end,
    approved_at=case when p_decision='approve' then now() else null end
  where id=p_idea_id;
  insert into public.content_idea_activity(content_idea_id,client_id,user_id,action,metadata)
  values (p_idea_id,idea.client_id,actor,case when p_decision='approve' then 'review_verified' else 'changes_requested' end,
    jsonb_build_object('note',coalesce(btrim(p_note),''),'videoFileId',p_video_file_id,
      'captionsVerified',p_decision='approve','videoVerified',p_decision='approve'));
  return jsonb_build_object('ok',true,'status',next_status);
end;
$$;
revoke all on function public.commit_internal_review(uuid,text,uuid,text,boolean,boolean) from public;
grant execute on function public.commit_internal_review(uuid,text,uuid,text,boolean,boolean) to authenticated;
