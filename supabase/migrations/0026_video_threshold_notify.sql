-- ============================================================
-- Migration 0026: notify when a client's video buffer drops below threshold
-- ============================================================
-- Buffer = content_ideas with status in ('grabada','producida') for the client.
-- When a content_idea transitions out of the buffer (e.g. to 'publicada' or
-- 'descartada') and that drops the buffer below clients.video_threshold for
-- the first time, insert a notification. Recipient: assigned_to, else all owners.

create or replace function public.notify_low_video_buffer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client       record;
  v_buffer_after int;
  v_buffer_before int;
begin
  if new.client_id is null then return new; end if;
  -- Only react when status actually changed.
  if new.status is not distinct from old.status then return new; end if;

  select id, name, assigned_to, video_threshold into v_client
  from public.clients where id = new.client_id;
  if v_client.video_threshold is null or v_client.video_threshold <= 0 then
    return new;
  end if;

  -- Current buffer (after this change is committed in the row's new state).
  select count(*) into v_buffer_after
  from public.content_ideas
  where client_id = new.client_id and status in ('grabada','producida');

  -- Was this row counted in the buffer before the change?
  v_buffer_before := v_buffer_after + (case when old.status in ('grabada','producida')
                                              and new.status not in ('grabada','producida')
                                         then 1 else 0 end);

  -- Only fire on the downward crossing of the threshold.
  if v_buffer_after < v_client.video_threshold
     and v_buffer_before >= v_client.video_threshold then
    if v_client.assigned_to is not null then
      insert into public.notifications (user_id, kind, title, body, link, severity, meta)
      values (
        v_client.assigned_to, 'task_due_soon',
        'Hay que grabar — ' || coalesce(v_client.name,'cliente'),
        'El buffer de videos bajó a ' || v_buffer_after || ' (límite ' || v_client.video_threshold || '). Agenda una grabación.',
        '/recording-calendar?client=' || new.client_id::text,
        'warning',
        jsonb_build_object('source','video_threshold','client_id',new.client_id,'buffer',v_buffer_after)
      );
    else
      insert into public.notifications (user_id, kind, title, body, link, severity, meta)
      select p.id, 'task_due_soon',
        'Hay que grabar — ' || coalesce(v_client.name,'cliente'),
        'El buffer de videos bajó a ' || v_buffer_after || ' (límite ' || v_client.video_threshold || '). Agenda una grabación.',
        '/recording-calendar?client=' || new.client_id::text,
        'warning',
        jsonb_build_object('source','video_threshold','client_id',new.client_id,'buffer',v_buffer_after)
      from public.profiles p where p.role = 'owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_video_buffer on public.content_ideas;
create trigger trg_notify_low_video_buffer
  after update on public.content_ideas
  for each row execute function public.notify_low_video_buffer();

notify pgrst, 'reload schema';
