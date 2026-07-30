-- Dos valores nuevos en el enum client_status: 'proximo_a_grabar' y
-- 'sin_contenido'.
--
-- YA APLICADO EN PRODUCCIÓN, y de momento SIN USAR a propósito.
--
-- La función que los aprovechaba se revirtió: el código de main filtra "cliente
-- vivo" con .eq('status','active') en 46 sitios, así que un cliente marcado
-- 'proximo_a_grabar' desaparecería de cadencia, del sync de Metricool, de los
-- captions y del plan semanal. Hasta que ese refactor llegue a main, nada debe
-- escribir estos dos valores.
--
-- El fichero se queda porque Postgres no sabe quitar valores de un enum
-- (no hay ALTER TYPE ... DROP VALUE) y porque las migraciones son el registro
-- de lo aplicado. Un valor de enum que nadie usa no hace nada.
--
-- Sin begin/commit: ALTER TYPE ... ADD VALUE no puede usarse en la misma
-- transacción en la que se añade, y cada ALTER es idempotente por su cuenta.

alter type public.client_status add value if not exists 'proximo_a_grabar';
alter type public.client_status add value if not exists 'sin_contenido';
