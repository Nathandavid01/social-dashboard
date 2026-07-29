-- Un editor solo lee los clientes que tiene asignados, y las ideas de esos
-- clientes. Hasta ahora era un filtro de pantalla: la política era
-- `using (true)`, así que llamando la API se veía todo igual.
--
-- Alcance deliberadamente estrecho: SOLO editor y disenador quedan acotados.
-- Owner, supervisor, copy, video y team_member siguen leyendo la cartera
-- entera — el videógrafo necesita los clientes para el calendario de
-- grabación, y acotarlo le dejaría la pantalla vacía sin que nadie lo pidiera.
--
-- El enlace público de revisión NO se ve afectado: usa funciones
-- SECURITY DEFINER (get_review_by_token y compañía), que no pasan por RLS.
--
-- get_my_role() es SECURITY DEFINER sobre profiles, así que usarla aquí no
-- provoca recursión de políticas.

-- ── clients ──────────────────────────────────────────────────────────────────
drop policy if exists "clients: authenticated read" on public.clients;

create policy "clients: read scoped by assignment"
  on public.clients for select to authenticated
  using (
    coalesce(public.get_my_role()::text, '') not in ('editor', 'disenador')
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

-- ── content_ideas ────────────────────────────────────────────────────────────
drop policy if exists "content_ideas: authenticated read" on public.content_ideas;

create policy "content_ideas: read scoped by client assignment"
  on public.content_ideas for select to authenticated
  using (
    coalesce(public.get_my_role()::text, '') not in ('editor', 'disenador')
    or client_id in (
      select id from public.clients where assigned_to = auth.uid()
    )
    -- Lo que el propio editor creó sigue siendo suyo aunque el cliente cambie
    -- de manos: si no, entregar un video y perder el cliente al día siguiente
    -- lo dejaría sin poder ver su propio trabajo.
    or created_by = auth.uid()
  );

-- ── content_idea_videos ──────────────────────────────────────────────────────
-- Los archivos siguen a su idea: sin esto, un editor acotado seguiría pudiendo
-- leer las filas de video de cualquier cliente y pedir su URL firmada.
-- El nombre real es "content_idea_videos: read" (migración 0019). Con el
-- nombre equivocado el drop no borra nada y las dos políticas se SUMAN:
-- en Postgres varias policies permisivas se combinan con OR, así que la
-- antigua `using (true)` dejaría el filtro nuevo sin efecto.
drop policy if exists "content_idea_videos: read" on public.content_idea_videos;

create policy "content_idea_videos: read follows the idea"
  on public.content_idea_videos for select to authenticated
  using (
    coalesce(public.get_my_role()::text, '') not in ('editor', 'disenador')
    or idea_id in (
      select i.id from public.content_ideas i
      where i.created_by = auth.uid()
         or i.client_id in (select id from public.clients where assigned_to = auth.uid())
    )
  );
