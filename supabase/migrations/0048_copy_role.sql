-- Rol "copy": escribe el copy de los videos ya aprobados. Ve el tablero
-- entero para saber qué viene y qué salió, pero no aprueba ni publica.
--
-- user_role es un enum: sin esto la app no puede guardar el rol aunque la
-- interfaz lo ofrezca.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'copy'
  ) then
    alter type public.user_role add value 'copy';
  end if;
end $$;
