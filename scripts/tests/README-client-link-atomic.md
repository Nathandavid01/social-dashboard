# Reemplazo Atómico Del Enlace Del Cliente — Preparado, No Activado

La migración `0075_atomic_client_review_link.sql` NO está conectada a `crearEnlaceCliente` ni aplicada al proyecto remoto. No desplegar la llamada al RPC antes de aplicar y verificar la migración en Supabase.

## Prueba local

En una base PostgreSQL vacía y aislada, con rol `authenticated` existente:

1. Ejecutar `client-link-atomic-fixture.sql`.
2. Ejecutar `../../supabase/migrations/0075_atomic_client_review_link.sql`.
3. Ejecutar `client-link-atomic-assertions.sql` con `psql -v ON_ERROR_STOP=1`.

El fixture simplifica tablas y no replica las políticas RLS reales. Nunca ejecutarlo en Supabase.

Se prueban creación/reintento, rollback por error de borrado, conservación de videos hermanos de enlaces compartidos, rechazo por cliente incorrecto, rol sin permiso y reintento de una solicitud sustituida. Las assertions revierten sus cambios.

En esta sesión se ejecutaron además 10 llamadas simultáneas como authenticated con el mismo request id, obteniendo un único token. La base de prueba es `nate_link_atomic`, socket `/tmp/nate-review-socket`, puerto 55439. Esos datos son exclusivamente locales.

## Integración pendiente

- Confirmar privilegios/RLS reales para owner, supervisor, editor y copy. La función usa SECURITY INVOKER.
- Sustituir el borrado y creación separados de `crearEnlaceCliente` por el RPC.
- Generar un UUID por intención de creación y conservarlo para reintentos de resultado incierto. No generar uno nuevo automáticamente tras un timeout.
- Verificar con medios y enlaces de prueba el contenido público: quitar una idea del enlace viejo, conservar sus otras ideas y hacer que la idea aparezca en el nuevo.
- Los padres vacíos se conservan expirados como registro de la solicitud, para rechazar reintentos antiguos. No borrarlos con un proceso de limpieza sin diseñar primero la retención de idempotencia.
- No se verifica aquí la disponibilidad HTTP del archivo ni se modifica Metricool.
