-- Aprobación del cliente por enlace, para el flujo de Entregas.
--
-- Tabla y funciones PROPIAS, sin tocar nada del flujo de Eric. Su enlace ya
-- existe (content_ideas.review_token + get_review_by_token + submit_client_review),
-- pero no sirve aquí por dos motivos comprobados:
--   a) su función filtra el video por storage_provider = 'r2', y los de Entregas
--      son 'entregas-r2': la página saldría sin video.
--   b) su aprobación dispara el envío automático a Metricool, y aquí la
--      aprobación PARA en Publicación: el envío lo sigue dando una persona.
-- Extender su función habría sido menos código, pero es suya. Aquí se duplica a
-- propósito.
--
-- Modelo de seguridad: el token (uuid aleatorio) ES la credencial. Las dos
-- funciones son SECURITY DEFINER y filtran por token dentro de la propia
-- función, así que la tabla no necesita quedar expuesta a anon.

begin;

create table if not exists public.entregas_client_reviews (
  id            uuid primary key default uuid_generate_v4(),
  idea_id       uuid not null references public.content_ideas(id) on delete cascade,
  token         uuid not null default uuid_generate_v4(),
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  comment       text,
  reviewer_name text,
  expires_at    timestamptz not null,
  decided_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create unique index if not exists entregas_client_reviews_token_key
  on public.entregas_client_reviews (token);

-- Un enlace vivo por video: generar otro invalida el anterior (lo borra la app).
create index if not exists entregas_client_reviews_idea_idx
  on public.entregas_client_reviews (idea_id, created_at desc);

alter table public.entregas_client_reviews enable row level security;

-- Solo el equipo autenticado ve/gestiona los enlaces desde el dashboard. El
-- cliente NO toca la tabla: entra por las funciones de abajo.
drop policy if exists "entregas_client_reviews: staff" on public.entregas_client_reviews;
create policy "entregas_client_reviews: staff"
  on public.entregas_client_reviews for all to authenticated
  using (true) with check (true);

-- ── Lectura pública por token ────────────────────────────────────────────────
-- Devuelve lo justo para la pantalla del cliente: el video y el estado. NO
-- devuelve el copy: el cliente aprueba la pieza, no revisa el texto.
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
    'idea_id',        ci.id,
    'client_name',    c.name,
    'status',         r.status,
    'expires_at',     r.expires_at,
    'comment',        r.comment,
    'reviewer_name',  r.reviewer_name,
    'video_key',      (
      select v2.drive_file_id
      from public.content_idea_videos v2
      where v2.idea_id = ci.id
        and v2.kind = 'edited'
        and v2.storage_provider = 'entregas-r2'
        and v2.drive_file_id is not null
      order by v2.uploaded_at desc
      limit 1
    )
  )
  into v
  from public.entregas_client_reviews r
  join public.content_ideas ci on ci.id = r.idea_id
  left join public.clients c on c.id = ci.client_id
  where r.token = p_token;

  return v;  -- null si el token no existe: la página lo convierte en 404
end;
$$;

-- ── Voto del cliente ─────────────────────────────────────────────────────────
-- Serializada por fila para que dos clics no cuenten dos veces. Un voto ya
-- emitido no se cambia: reenviar el enlace no puede revertir un aprobado que ya
-- movió la tarjeta.
create or replace function public.submit_entregas_review(
  p_token    uuid,
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
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'decision_invalida');
  end if;

  select * into r from public.entregas_client_reviews
  where token = p_token for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_desconocido');
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ya_votado', 'status', r.status);
  end if;
  if r.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencido');
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_comment), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'falta_comentario');
  end if;

  update public.entregas_client_reviews
     set status = p_decision,
         comment = nullif(btrim(p_comment), ''),
         reviewer_name = nullif(btrim(p_name), ''),
         decided_at = now()
   where id = r.id;

  return jsonb_build_object('ok', true, 'idea_id', r.idea_id, 'status', p_decision);
end;
$$;

-- ── El rechazo devuelve el video al editor ───────────────────────────────────
-- El cliente es anónimo y no puede escribir en content_ideas: RLS lo impide, y
-- debe seguir impidiéndolo. Esta función hace los dos cambios juntos, y solo
-- sobre el video de ESE token — no acepta un idea_id suelto.
create or replace function public.entregas_client_rejected(
  p_token   uuid,
  p_comment text,
  p_name    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idea uuid;
begin
  select r.idea_id into v_idea
  from public.entregas_client_reviews r
  where r.token = p_token and r.status = 'rejected';

  if v_idea is null then
    return jsonb_build_object('ok', false, 'error', 'no_rechazado');
  end if;

  -- Vuelve a la columna del editor. Mismo estado que usa la revisión interna,
  -- así la tarjeta aparece donde el editor ya sabe mirar.
  update public.content_ideas
     set approval_status = 'revision_needed'
   where id = v_idea;

  -- El texto, donde la tarjeta ya lee las correcciones. user_id null: quien
  -- pide el cambio no es del equipo.
  insert into public.content_idea_activity (content_idea_id, user_id, action, metadata)
  values (
    v_idea, null, 'client_requested_changes',
    jsonb_build_object('note', btrim(p_comment), 'cliente', coalesce(nullif(btrim(p_name), ''), 'Cliente'))
  );

  return jsonb_build_object('ok', true, 'idea_id', v_idea);
end;
$$;

revoke all on function public.get_entregas_review(uuid) from public;
revoke all on function public.entregas_client_rejected(uuid, text, text) from public;
grant execute on function public.entregas_client_rejected(uuid, text, text) to anon, authenticated;
revoke all on function public.submit_entregas_review(uuid, text, text, text) from public;
grant execute on function public.get_entregas_review(uuid) to anon, authenticated;
grant execute on function public.submit_entregas_review(uuid, text, text, text) to anon, authenticated;

commit;
