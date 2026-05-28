-- ============================================================
-- Migration 0020: Auto-notify "reagenda la próxima sesión"
-- ============================================================
-- When a recording_session moves to status='completed' AND the client has no
-- other future session booked, insert a notification for whoever the
-- videographer was (or for the creator, as fallback).

create or replace function public.notify_reschedule_on_session_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient    uuid;
  v_client_name  text;
  v_has_future   boolean;
begin
  -- Only fire on transition into 'completed'.
  if new.status is distinct from 'completed' or
     (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;

  -- Skip if no client (sessions without client_id aren't part of the planning loop).
  if new.client_id is null then
    return new;
  end if;

  -- Pick recipient: videographer first, else creator.
  v_recipient := coalesce(new.videographer_id, new.created_by);
  if v_recipient is null then
    return new;
  end if;

  -- Check if a future session already exists for this client.
  select exists (
    select 1
    from public.recording_sessions s
    where s.client_id = new.client_id
      and s.id <> new.id
      and s.session_date >= current_date
      and s.status <> 'cancelled'
  ) into v_has_future;

  if v_has_future then
    return new; -- no need to nag; planning is already covered
  end if;

  select name into v_client_name from public.clients where id = new.client_id;

  insert into public.notifications (user_id, kind, title, body, link, severity, meta)
  values (
    v_recipient,
    'meeting_reminder',
    'Reagenda la próxima sesión de ' || coalesce(v_client_name, 'cliente'),
    'Acabas de completar la grabación. Antes de cerrar el día, agenda la próxima sesión para que el cliente no quede sin contenido.',
    '/recording-calendar?client=' || new.client_id::text,
    'warning',
    jsonb_build_object('source', 'session_complete_trigger', 'session_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_reschedule_on_session_complete on public.recording_sessions;
create trigger trg_notify_reschedule_on_session_complete
  after update on public.recording_sessions
  for each row
  when (new.status = 'completed' and (old.status is distinct from 'completed'))
  execute function public.notify_reschedule_on_session_complete();

notify pgrst, 'reload schema';
