# Auditoría Del Flujo · 8 Septiembre 2026

Objetivo activo: un sistema y flujo sin fallos. No se considera completado por pasar pruebas unitarias.

## Evidencia De Esta Revisión

- Estado inicial limpio en `codex/flujo-metricool-septiembre`, después de v4.22.
- Suite completa: 354 archivos pasaron, 1 omitido; 2,869 pruebas pasaron, 3 omitidas. Comando: `npx vitest run --exclude '**/.claude/**'`.
- Fallo reproducido con pruebas: `toggleShotRecorded(recorded: true)` sobrescribía estados producida/publicada/descartada desde una pantalla desactualizada. Reintentos también cambiaban recording_date. Una lectura seguida de escritura sin condición permitía pisar cambios concurrentes.
- Corregido con guardia de estados, confirmación idempotente, fecha Puerto Rico y actualización condicional por estado leído. Siete regresiones nuevas. Conjunto afectado: 30 pruebas pasan; TypeScript y merge-gate pasan.
- Navegación de la vista previa de On Site verificada. Sin errores en consola. Las pruebas de la vista previa no prueban los permisos ni escrituras reales.
- Navegador autenticado en vista de Anibeliz redirige On Site a Inicio. No se cambiaron sus permisos ni suplantación para esta revisión.

## Requisitos Aún Pendientes De Evidencia

- Validación autenticada por rol: dueño, supervisor, videógrafo y editor; revisar permisos/grants y accesos por enlaces del dashboard.
- Sesión real: agendar → On Site → vincular ideas → grabar → subir raw → edición y capacidad del editor.
- Archivo editado con captions: reproducción real, revisión completa, devolución con comentario, nueva versión, reenvío y aprobación del archivo exacto.
- Resumen operativo, checklist y notificaciones: coherencia de conteos, responsable y siguiente acción después de cada transición real.
- Metricool: credenciales activas, agenda para fecha acordada, errores recuperables sin duplicados y confirmación independiente de publicación por red.
- Publicaciones vencidas/futuras: auditoría real de cobertura, atrasos y estado desconocido sin reportar éxito falso.
- QA responsive autenticada, errores de red, reintentos, sesiones vencidas y concurrencia en los pasos restantes.
- Investigar pruebas omitidas y cobertura faltante; verificar CI y producción por separado. Trabajo actual local, sin publicación ni migraciones ejecutadas.

No se enviaron mensajes, se programaron posts ni se cambiaron datos de clientes durante esta revisión.

## Continuación · Reintentos Metricool

- Reproducido: `createDraftPost` reenviaba POST tras cualquier HTTP no exitoso si había opciones de formato. Una respuesta 5xx no prueba que el primer POST no creó la publicación.
- v4.24 limita el fallback de formato a 400/422. Regresiones nuevas cubren 401/403/408/429/500/502/503/504, validación y fallo de transporte.
- **Pendiente prioritario:** `runIdeaPost` libera el claim ante resultados inciertos y permite recuperar claims después de cinco minutos. También devuelve éxito aunque fallen todos los intentos de guardar la respuesta remota. Hay que reconciliar con Metricool antes de permitir reenvíos y representar los resultados desconocidos sin éxito falso. La corrección del conector no resuelve ese riesgo en la capa superior.
- Ninguna solicitud real fue enviada a Metricool en estas pruebas.

## Continuación · Registro Del Resultado Remoto

- v4.25 corrige el éxito falso si las tres escrituras de bookkeeping devuelven error. El resultado ahora contiene error e ID remoto; no ok, y no libera el claim en esta ruta.
- La regresión reproduce tres fallos de DB después de una única creación remota. El flujo exitoso conserva su cobertura existente.
- Sigue pendiente la recuperación/reconciliación: la expiración de claims y los fallos de transporte aún requieren tratamiento. Esta corrección no garantiza por sí sola ausencia de duplicados después de cinco minutos.

## Continuación · Resultado Incierto

- v4.26 elimina el takeover automático de claims vencidos. Un timeout o error ambiguo conserva posting_started_at; otro click incluso después de seis minutos no ejecuta POST.
- Rechazos HTTP explícitos y ausencia de configuración se clasifican como definitivamente no creados; pueden liberar el claim. Respuestas sin identificadores conservan estado incierto.
- Pruebas focales: 37 pasan; TypeScript y merge-gate pasan.
- **Pendiente para cerrar este flujo:** implementar una acción autenticada de reconciliación con evidencia remota y UI para resolver los claims inciertos (incluidos los anteriores). Por ahora permanecen bloqueados; no hay una liberación automática ni se debe editar la DB a ciegas.
- También revisar errores previos al POST que lanzan excepciones, comparaciones atómicas con aprobación/archivo y observabilidad en Mi Día. No hay envíos reales en estas pruebas.

## Continuación · Recuperación Con Evidencia Positiva

- v4.27 añade panel en settings/metricool, bajo posting.publish, para introducir el ID remoto de una idea bloqueada.
- GET del scheduler limitado al blog del cliente; requiere coincidencia de media URL, caption, redes, autoPublish y no-draft. La escritura es condicional al claim, cliente, caption, archivo aprobado y ausencia de ID anterior. No envía POST ni declara publicada la idea.
- 14 pruebas iniciales pasan (matcher, permisos, ID inexistente, concurrencia y formulario); preview real del componente verificado en escritorio/móvil con mocks explícitos. TypeScript y merge-gate pasan.
- **Límites pendientes:** comprobar contra respuesta real de Metricool; media de estructura no reconocida se rechaza. Ventana de búsqueda ±365 días de la fecha planificada; no encontrar un post no prueba ausencia. Recuperación de un envío realmente no creado continúa pendiente: no existe aún liberación sin evidencia. El panel muestra hasta 100 casos.

## Continuación · Verificación Real Y Lotes

- Consultas de solo lectura a Supabase: 0 ideas con posting_started_at no nulo y metricool_post_id nulo al momento de consultar.
- GET real del scheduler en dos blogs de clientes activos, septiembre 2026: ambos HTTP 200; 8 y 3 posts. Media es un array de strings, formato aceptado por el matcher. No se guardaron tokens ni contenido de posts en el informe. Esto valida el contrato de lectura, no una recuperación real ni coincidencias de archivos.
- Reproducido corte de conexión en PublishCardButton: la promesa rechazada escapaba sin restaurar busy, y resultados vacíos contaban como éxito. v4.28 captura el error por video, conserva el conteo confirmado y continúa el lote sin reenviar la idea fallida.
- No se enviaron publicaciones ni se modificaron registros externos en esta auditoría.

## Continuación · Reenvío De Correcciones

- v4.29 añade lectura de estados de publicación y un update condicionado a approval_status y ausencia de envío. Se conservan el control del editor asignado y archivo posterior a changes_requested.
- Regresiones: envío con ID, posted_at, claim incierto, publicada/descartada y cambio concurrente. Caso válido conserva reenvío y filtros de concurrencia comprobados.
- Pendiente: atomicidad entre historia de revisión y estado (decideReview escribe historia antes del update), carrera con subida de una nueva versión y envío a Metricool; evidencia real de revisión completa y notificación al editor.

## Continuación · Avisos De Revisión

- v4.30 conecta decideReview/resubmitForReview a notificaciones personales después de guardar el estado. Correcciones y aprobación van al editor de tarea, cliente o creador en ese orden; reenvíos a dueños/supervisores activos, excluyendo actor y duplicados.
- Fallos devuelven warning, mostrado por la subida de corrección, overlay de revisión y botón de envío inicial. Se mantiene el estado guardado y se indica consultar Mi Día.
- Pruebas locales cubren destinatarios, comentario, deduplicación y fallo de entrega. No se enviaron notificaciones reales: entrega end-to-end sigue pendiente.
- Las notificaciones son best effort; falta outbox transaccional para garantizar entrega tras caídas. La atomicidad historia/estado continúa pendiente.

## Continuación · Estado Real Y Comentarios Del Cliente

- Lectura real: 493 ideas; 116 aprobadas sin approved_video_id (incluye históricas y descartadas). `review_verified`: 0 registros. No equivale a afirmar que nadie revisó los videos: falta la evidencia formal que exige el flujo nuevo.
- 19 sesiones desde 8 septiembre, no canceladas: todas sin client_id y sin videographer_id. Requieren vinculación/asignación real; no se inventaron responsables.
- v4.31 corrige resubmitForReview: consulta la última corrección entre changes_requested y client_requested_changes, como ya hace la tarjeta de revisión. Regresión reproduce un archivo anterior a un comentario de cliente y verifica que no escribe el estado.
- La suite completa de v4.30 terminó; ver log local `/tmp/full-audit-current.log`. Los checks focales de v4.31 se ejecutaron después.

## Continuación · Comprobación Del Video Antes Del Claim

- v4.32 limita fetch del probe de video a 10 segundos y lo coloca antes del claim persistente. Si el video no es reproducible/no responde no hay escrituras de claim ni POST remoto.
- Regresiones verifican AbortSignal y ausencia de escrituras después de preflight fallido, junto a idempotencia y resultado incierto existentes.
- Se solicitó al usuario quién resolverá las asignaciones reales de las 19 próximas grabaciones. Esto no bloquea las correcciones de código pendientes.

## Continuación · Snapshot De Publicación

- v4.33 añade condiciones al UPDATE que adquiere el claim: aprobación approved, mismo archivo/caption/status/publish_date y ausencia de posted_at/published_at. Evita usar la lectura previa al preflight cuando esa fila ya cambió.
- Siete regresiones simulan cambios durante health check y el caso intacto; checks relacionados de idempotencia y errores siguen pasando. No se hicieron POST reales.
- Sigue pendiente: impedir/coordinar cambios después de adquirir el claim, cambios concurrentes en configuración del cliente, e historia de revisión/estado atómicos.

## Continuación · Revisión Atómica Preparada

- Nueva migración `0074_atomic_internal_review.sql`: función `commit_internal_review` con SECURITY INVOKER, control de owner/supervisor activo, validación de captions/archivo propio, bloqueo de fila y escritura conjunta de estado e historial.
- Probada en PostgreSQL 16 aislado mediante socket `/tmp/nate-review-socket`, sin acceso a datos de clientes. Fixture y assertions en scripts/tests. Casos: aprobación+historia; decisión obsoleta sin historia nueva; fallo de insert revierte estado; editor rechazado. Dos conexiones concurrentes produjeron una sola aprobación y un solo historial.
- **No aplicada a Supabase ni conectada al server action**. Supabase CLI está autenticado y lista 16 proyectos, pero ninguno coincide con el host/ref de NEXT_PUBLIC_SUPABASE_URL de este checkout. No hay DATABASE_URL ni credencial directa de Postgres configurada. La acción actual sigue usando las escrituras separadas hasta resolver acceso y activar esta migración.
- Antes de activar: verificar esquema y RLS reales; probar RPC autenticado por rol; migrar decideReview para llamar al RPC sin fallback no atómico; conservar notificaciones después del commit. Añadir test de autorización con las políticas reales. La migración local no demuestra que el fallo esté resuelto en la app.

## v4.34 — Reabrir una aprobación durante un envío

- Se reprodujo con cuatro regresiones fallidas: un envío activo o antiguo sin confirmar permitía quitar el archivo aprobado; estados publicada/descartada también se reabrían si faltaban timestamps históricos.
- `reopenReviewForVerification` ahora exige ausencia de `posting_started_at` y excluye estados cerrados en la misma actualización condicional. Conserva la aprobación si otra operación ya adquirió el envío.
- Validación: 11 pruebas focales pasan, TypeScript y merge-gate pasan. Preview de estados (simulación) servido HTTP 200 en `/previews/v4.34-reabrir-revision.html`.
- Cambio local: no se modificaron datos de clientes ni se enviaron posts. La migración atómica 0074 sigue pendiente de acceso al proyecto de Nathan y no está activa.

## v4.35 — Descartar sin ocultar envíos de Metricool

- Ocho regresiones reprodujeron descartes indebidos con ID remoto/claim/timestamps y conteos falsos de IDs duplicados, ausentes o cerrados.
- El UPDATE excluye envíos en curso, enviados, publicados y estados cerrados; devuelve el número real de filas cambiadas. En lotes mixtos se descartan solo los elegibles y se informa explícitamente el resultado parcial.
- Dos regresiones UI reprodujeron falta de refresh parcial y botón bloqueado por excepción de transporte. Ahora se actualiza el tablero y siempre se libera el botón sin inventar éxito.
- Suite completa: 371 archivos pasan, 1 omitido; 2944 pruebas pasan, 3 omitidas. TypeScript, merge-gate y diff-check pasan. Preview de avisos simulado servido HTTP 200: `/previews/v4.35-descartar-entregas.html`.
- Local, sin publicación ni cambios en datos reales. Pendiente: auditar autorización de descarte por propietario/asignación (la acción conserva el permiso existente `video.upload`); aplicar/verificar la revisión atómica cuando haya acceso a Supabase de Nathan; validar el flujo autenticado completo.

## v4.36 — Autorización de descarte

- El control anterior `video.upload` permitía a editores, videógrafos y diseñadores descartar entregas mediante la acción directa. Cinco pruebas UI también comprobaron que el botón se mostraba a roles no administrativos.
- Permiso dedicado `video.discard`, solo para owner/supervisor. Se exige en la acción y se consulta en el botón. Subir archivos no concede el poder de cerrar trabajo.
- Ocho regresiones fallaron antes del cambio; 98 pruebas focales pasan después (acción, botón, tablero, permisos). TypeScript, merge-gate y diff-check pasan.
- Preview explicativo: `/previews/v4.36-permisos-descarte.html` (simulación). No se ejecutaron descartes con datos reales. Falta validar las políticas de base de datos y las pantallas autenticadas por rol; esto verifica la autorización en los puntos de entrada de la aplicación, no constituye una auditoría completa de RLS.

## v4.37 — Evidencia real en el resumen de publicaciones de hoy

- Inspección de `execGetTodaysPosts`: antes clasificaba como publicado cualquier post no borrador cuya fecha había pasado, descartaba textos vacíos y convertía respuestas HTTP fallidas en listas vacías. Usaba además el día local del servidor y un límite de 50 clientes.
- Ahora usa el lector compartido de Metricool (timeout y errores), consulta el día de Puerto Rico, incluye todos los clientes activos devueltos y distingue confirmado/pendiente/error/borrador con estados por red. Confirma publicado solo mediante `isScheduledPostPublished`; no infiere éxito por tiempo transcurrido.
- Evidencia de consulta incompleta explícita cuando falla una cuenta; no se transforma en ausencia de publicaciones. La hora de consulta se expone al modelo junto con la instrucción de no llamar atrasados a posts futuros.
- 15 pruebas pasan (incluye UTC ya en el día siguiente, estados parciales, borradores, errores y texto vacío), TypeScript y merge-gate pasan.
- Cambio local. Pendiente: comprobar respuesta final del chat autenticado y auditar las demás herramientas de briefing/agenda que tienen consultas independientes; verificar la ventana efectiva de resultados de `extendedRange` en datos vivos. No se ejecutaron publicaciones ni notificaciones.
