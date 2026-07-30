-- Dos estados nuevos de cliente: "próximo a grabar" y "sin contenido".
--
-- Describen en qué punto está el trabajo, no si el cliente sigue con nosotros:
-- los tres (activo incluido) cuentan como cliente en producción. Las consultas
-- que antes hacían .eq('status','active') ahora leen ESTADOS_VIVOS
-- (lib/clients/estado.ts), para que marcar un cliente "próximo a grabar" no lo
-- saque de cadencia, Metricool, captions ni el plan semanal.
--
-- Sin begin/commit a propósito: ALTER TYPE ... ADD VALUE no puede usarse en la
-- misma transacción en la que se añade el valor, y estos dos ALTER son
-- idempotentes por separado gracias a IF NOT EXISTS.

alter type public.client_status add value if not exists 'proximo_a_grabar';
alter type public.client_status add value if not exists 'sin_contenido';
