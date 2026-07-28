-- Rol "disenador": entrega piezas y trabaja ideas, pero no escribe el copy ni
-- decide sobre videos. user_role es un enum, así que sin esto la app no puede
-- guardar el rol aunque la interfaz lo ofrezca.
--
-- Sin acento y sin ñ a propósito: es un valor de enum que viaja por URLs, JSON
-- y comparaciones en SQL. La etiqueta bonita vive en ROLE_LABEL.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'disenador'
  ) then
    alter type public.user_role add value 'disenador';
  end if;
end $$;
