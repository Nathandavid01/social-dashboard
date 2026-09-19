-- Recibo / AI intake: staff-facing manual posted + client-approval flags.
-- Keeps Metricool bookkeeping (posted_at, metricool_*) untouched.
-- Also: Arecibo Lab → edit_mode='ai' (no assigned_to change — leave for Eric).
-- Plus: public get_entregas_review returns client_logo_url for branded /aprobacion.

alter table public.content_ideas
  add column if not exists manual_posted_status text null;

alter table public.content_ideas
  drop constraint if exists content_ideas_manual_posted_status_check;

alter table public.content_ideas
  add constraint content_ideas_manual_posted_status_check
  check (manual_posted_status is null or manual_posted_status in ('posted', 'not_posted'));

alter table public.content_ideas
  add column if not exists staff_client_approval text null;

alter table public.content_ideas
  drop constraint if exists content_ideas_staff_client_approval_check;

alter table public.content_ideas
  add constraint content_ideas_staff_client_approval_check
  check (staff_client_approval is null or staff_client_approval in ('approved', 'rejected'));

comment on column public.content_ideas.manual_posted_status is
  'Staff mark: posted | not_posted. Independent of Metricool posted_at.';

comment on column public.content_ideas.staff_client_approval is
  'Staff mark without public link: approved | rejected. Independent of entregas_client_review_items.';

-- Arecibo Lab (cd02f509-4e1d-49f2-aee7-e59942b16ffd): AI Recibo intake.
-- Do NOT invent assigned_to — currently null; Eric decides editor assignment.
update public.clients
   set edit_mode = 'ai'
 where id = 'cd02f509-4e1d-49f2-aee7-e59942b16ffd';

-- Branded approval page: expose real logo_url only (never invent).
create or replace function public.get_entregas_review(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'review_id',        r.id,
    'client_name',      c.name,
    'client_logo_url',  c.logo_url,
    'expires_at',       r.expires_at,
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'idea_id',       it.idea_id,
        'titulo',        ci.title,
        'status',        it.status,
        'comment',       it.comment,
        'reviewer_name', it.reviewer_name,
        'video_key', (
          select v2.drive_file_id
          from public.content_idea_videos v2
          where v2.idea_id = it.idea_id
            and v2.kind = 'edited'
            and v2.storage_provider = 'entregas-r2'
            and v2.drive_file_id is not null
          order by v2.uploaded_at desc
          limit 1
        )
      ) order by it.created_at)
      from public.entregas_client_review_items it
      join public.content_ideas ci on ci.id = it.idea_id
      where it.review_id = r.id
    ), '[]'::jsonb)
  )
  into v
  from public.entregas_client_reviews r
  left join public.clients c on c.id = r.client_id
  where r.token = p_token;

  return v;
end;
$$;

revoke all on function public.get_entregas_review(uuid) from public;
grant execute on function public.get_entregas_review(uuid) to anon, authenticated;

-- Keep v2 in sync if deployed (staged; app still calls get_entregas_review).
create or replace function public.get_entregas_review_v2(p_token uuid)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
  'review_id',r.id,
  'client_name',c.name,
  'client_logo_url',c.logo_url,
  'expires_at',r.expires_at,
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
    and (it.status='pending' or v.id=it.video_file_id)
   order by v.uploaded_at desc nulls last,v.id desc limit 1
  ) media on true
  where it.review_id=r.id),'[]'::jsonb))
 from public.entregas_client_reviews r left join public.clients c on c.id=r.client_id
 where r.token=p_token;
$$;
revoke all on function public.get_entregas_review_v2(uuid) from public;
grant execute on function public.get_entregas_review_v2(uuid) to anon,authenticated;
