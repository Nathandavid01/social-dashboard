-- Un enlace por TARJETA, no por video.
--
-- 0054 creó un enlace por video. Una tarjeta agrupa los videos de un cliente
-- para un día, así que mandarle cinco enlaces por WhatsApp y explicarle cuál es
-- cuál es peor para todos. Ahora: un enlace, varios videos dentro, y el cliente
-- decide cada uno por separado.
--
-- El enlace pasa a ser el padre (entregas_client_reviews) y cada video una
-- fila hija (entregas_client_review_items) con su propio voto.

begin;

create table if not exists public.entregas_client_review_items (
  id            uuid primary key default uuid_generate_v4(),
  review_id     uuid not null references public.entregas_client_reviews(id) on delete cascade,
  idea_id       uuid not null references public.content_ideas(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  comment       text,
  reviewer_name text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (review_id, idea_id)
);

create index if not exists entregas_client_review_items_review_idx
  on public.entregas_client_review_items (review_id);

alter table public.entregas_client_review_items enable row level security;

drop policy if exists "entregas_client_review_items: staff" on public.entregas_client_review_items;
create policy "entregas_client_review_items: staff"
  on public.entregas_client_review_items for all to authenticated
  using (true) with check (true);

-- El padre deja de apuntar a un video y pasa a apuntar al cliente.
alter table public.entregas_client_reviews
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- Migrar lo que ya existe: cada enlace viejo se convierte en su propio item,
-- conservando el voto que el cliente ya emitió.
insert into public.entregas_client_review_items (review_id, idea_id, status, comment, reviewer_name, decided_at)
select r.id, r.idea_id, r.status, r.comment, r.reviewer_name, r.decided_at
from public.entregas_client_reviews r
where r.idea_id is not null
on conflict (review_id, idea_id) do nothing;

update public.entregas_client_reviews r
   set client_id = ci.client_id
  from public.content_ideas ci
 where ci.id = r.idea_id and r.client_id is null;

alter table public.entregas_client_reviews
  drop column if exists idea_id,
  drop column if exists status,
  drop column if exists comment,
  drop column if exists reviewer_name,
  drop column if exists decided_at;

commit;

-- ── Funciones, reescritas para el lote ───────────────────────────────────────
-- Fuera de la transacción anterior a propósito: si algo falla aquí, la
-- reestructuración de las tablas ya quedó firme y no hay que rehacerla.

begin;

drop function if exists public.get_entregas_review(uuid);
drop function if exists public.submit_entregas_review(uuid, text, text, text);
drop function if exists public.entregas_client_rejected(uuid, text, text);

-- Todo lo que ve el cliente: el cliente, la caducidad y sus videos. NO devuelve
-- el copy — aprueba la pieza, no el texto.
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
    'review_id',   r.id,
    'client_name', c.name,
    'expires_at',  r.expires_at,
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

  return v;  -- null si el token no existe: la página lo convierte en 404
end;
$$;

-- El voto de UN video dentro del enlace. Serializada por fila para que dos
-- clics no cuenten dos veces, y acotada al token: el idea_id que llega tiene
-- que pertenecer a ese enlace.
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
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'decision_invalida');
  end if;

  select * into r from public.entregas_client_reviews where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_desconocido');
  end if;
  if r.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencido');
  end if;

  select * into it from public.entregas_client_review_items
   where review_id = r.id and idea_id = p_idea_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'video_no_es_de_este_enlace');
  end if;
  if it.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ya_votado', 'status', it.status);
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

revoke all on function public.get_entregas_review(uuid) from public;
revoke all on function public.submit_entregas_review(uuid, uuid, text, text, text) from public;
grant execute on function public.get_entregas_review(uuid) to anon, authenticated;
grant execute on function public.submit_entregas_review(uuid, uuid, text, text, text) to anon, authenticated;

commit;
