-- El supervisor puede actualizar clientes.
--
-- La política de UPDATE venía de 0001 y solo dejaba pasar a owner, al editor ya
-- asignado y a quien creó el cliente. El supervisor tiene 'clients.edit' en la
-- app, así que entraba a /clients/asignaciones y usaba la pantalla — pero la
-- base rechazaba la escritura.
--
-- Y lo hacía en silencio: en Postgres un UPDATE que no pasa la política no da
-- error, actualiza 0 filas. La acción devolvía "ok", la pantalla decía que se
-- guardó, y no se guardaba nada. Con 5 supervisores y 68 clientes, cuatro de
-- ellos no podían tocar ninguno y el quinto solo el que había creado.
--
-- Se conservan assigned_to y created_by: un editor sigue pudiendo actualizar el
-- cliente que tiene asignado, que es como estaba.

begin;

drop policy if exists "clients: update" on public.clients;

create policy "clients: update"
  on public.clients for update to authenticated
  using (
    public.get_my_role() in ('owner', 'supervisor')
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

commit;
