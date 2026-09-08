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

## v4.38 — Ventana real de Metricool y fechas de hoy

- Consulta read-only real a tres cuentas activas: HTTP 200 en las tres. Al pedir solo Sept 8 con extendedRange=true, la primera devolvió dos posts (Sept 7 14:00 publicado y Sept 8 09:00 pendiente). Las otras devolvieron un post pendiente cada una.
- El resumen filtra por día de Puerto Rico tras interpretar ISO absoluto o fecha local con zona IANA; fechas imposibles o ilegibles se señalan aparte. No se oculta esa incertidumbre como una agenda vacía.
- Se ejecutó el helper compilado contra la primera cuenta real: 2 posts recibidos, 1 incluido, ninguna fecha de ayer, estado PENDING preservado. Solo GET/SELECT; sin posts ni cambios de clientes.
- 18 pruebas focales pasan (incluye otras zonas, offsets, fecha inválida y salto DST), TypeScript y merge-gate pasan. Cuatro regresiones fallaban antes del filtro.
- Pendientes de la auditoría completa: otras herramientas del chat con consultas independientes, salida final del modelo con sesión autenticada y migración de revisión en el proyecto de Nathan.

## v4.39 — Resumen operativo compartido con el chat

- `execGetDashboardSummary` contaba producción desde `production_tasks` (200 filas), mientras Mi día usa `content_ideas` y la revisión verificada. Ese cálculo independiente se eliminó del briefing.
- Ahora se llama al mismo `getOperationsOverview`, conservando su RBAC y detección de errores/límites. Formatter presenta checklist, revisiones/correcciones/bloqueos/listos y capacidad de editores. También incluye `execGetTodaysPosts` para evidencia remota.
- El detalle se limita a ocho filas por sección con cantidad restante y enlace a Mi día; los totales no se recortan. Se mantienen las secciones de tareas generales, clientes, inbox y QC.
- 13 pruebas focales pasan, TypeScript y merge-gate pasan. Preview simulado `/previews/v4.39-resumen-compartido.html`. Sin publicar ni generar mensajes a usuarios.
- Pendiente: las secciones antiguas de tareas/alertas/inbox del briefing todavía requieren manejo de error explícito y filtro temporal de alertas; verificar respuesta final del chat autenticado, no solo el formatter. Acceso al proyecto Supabase de Nathan sigue necesario para revisión atómica.

## v4.40 — Lectura fiable de alertas

- La política SQL existente ya filtra vencidas, target_role y dismissed_by; no se ha afirmado que la política viva falle. El fallo confirmado de aplicación era consulta limitada a 5/10 filas e ignorar `error` en el chat, que podía producir un falso 'All clear'.
- Las dos herramientas de chat usan `getAlerts`; el lector exige sesión, propaga errores, detecta respuesta truncada mediante count exacto y refuerza exclusión de vencidas/descartadas.
- Tres regresiones fallaron antes del cambio; cinco pruebas del lector pasan. Suite completa: 374 archivos pasan, 1 omitido; 2983 pruebas pasan, 3 omitidas. TypeScript, merge-gate y diff-check pasan.
- Local, no se descartaron ni enviaron alertas reales. Preview simulado: `/previews/v4.40-alertas-verificadas.html`.
- Pendiente: otras consultas de tareas/inbox/clientes del briefing conservan manejo de errores insuficiente; verificar chat autenticado y política real de alertas. La migración de revisión atómica sigue sin aplicar por falta de acceso al proyecto de Nathan.

## v4.41 — Checklist y publicaciones externas (QA autenticada)

- Navegación real localhost:3038/mi-dia, sesión en vista de Denisha Matos (Supervisor). Mi día cargó 30 compromisos, 31 revisiones, 3 correcciones y 25 bloqueos; el chat respondió con esos mismos conteos. La respuesta aún mezcló 'pendientes' con 'draft' y repitió una alerta de cuatro posts: sigue pendiente revisar esa síntesis y las alertas almacenadas.
- Bug observado: el chat y Metricool confirmaban Arasibo publicado, pero el checklist lo seguía mostrando como 'Falta Preparar El Video De Hoy'.
- `PublicationChecklist` comunica su reporte a la vista; se concilian solo compromisos sintéticos sin pieza local cuando el día está cubierto con publicación real. Nunca se aprueba ni publica por asociación un video interno diferente. Resultados fallidos/de otro día no completan el compromiso.
- QA real posterior: contador bajó de 30 a 29 por publicar, 1/30 publicados, Arasibo muestra 'Publicado En Metricool · Sin Pieza Vinculada'. Sin mutaciones ni publicaciones externas.
- 10 pruebas focales pasan, TypeScript y merge-gate pasan. Preview: `/previews/v4.41-checklist-metricool.html`.
- Pendiente: aplicar esta conciliación también al resumen de chat del servidor; mejorar la lista larga de cobertura y los responsables 'Sin Asignar'; la revisión atómica permanece sin activar en Supabase de Nathan.

## v4.42 — Conciliación de checklist en el briefing

- La contradicción observada en QA autenticada v4.41 queda atendida en el generador de contexto del chat: `execGetDashboardSummary` obtiene `auditOperationalPublications` y usa `reconcileTodayChecklist` en el formatter, igual que la pantalla.
- Incluye contadores separados de compromisos publicados y por publicar. No marca aprobaciones internas ni enlaza posts a videos distintos. Fallos/parcialidad remota se comunican expresamente.
- Dos regresiones fallaron antes del cambio; 14 pruebas focales pasan, TypeScript, merge-gate y diff-check pasan.
- Preview de estados simulado `/previews/v4.42-chat-checklist.html`. El cambio está local; la síntesis final del modelo aún requiere una nueva comprobación autenticada. Se conserva el pendiente de tareas/alertas textuales antiguas y errores en consultas secundarias del briefing.

## v4.43 — Fechas y cobertura fuera de cadencia

- Cuatro regresiones reprodujeron: asignación UTC al día equivocado en PR; post ERROR/PENDING fuera de cadencia con expected=0 que se marcaba cubierto; fechas inválidas sin advertencia.
- Se extrajo el parser de fechas ya probado a `lib/metricool/publication-date.ts`. `buildCoverage` y el resumen diario usan la misma conversión. Un día con posts remotos cuenta al menos un compromiso; ERROR/PENDING no completan hoy. Una fecha ilegible marca la cuenta con error para que no se sume como verificada.
- 32 pruebas focales pasan, TypeScript y merge-gate pasan. Preview simulado `/previews/v4.43-cobertura-fechas.html`. No se modificaron datos ni publicaciones.
- Sigue pendiente: respuesta final del chat autenticado después de v4.42; errores de consultas generales de briefing, asignaciones reales de sesiones, revisión atómica en Supabase de Nathan y auditoría completa del ciclo de medios.

## v4.44 — Conteos generales del briefing

- Inspección confirmó que el resumen ignoraba errores de tareas/clientes/solicitudes/QC y sustituía null por cero. También podía contar una lista truncada de tareas como inventario completo.
- Se exige count exacto, ausencia de error y correspondencia entre filas y total en tareas. Si la consulta no se verifica, el briefing muestra el problema y conserva los resultados independientes de workflow/Metricool, sin publicar cifras generales falsas. Se eliminó una consulta de perfiles no utilizada.
- Cuatro pruebas de respuestas fallidas/truncadas/vacías/exactas pasan; TypeScript, merge-gate y diff-check pasan. Preview simulado `/previews/v4.44-resumen-sin-verificar.html`.
- No se manipularon datos vivos para inducir fallos. Pendiente: volver a comprobar síntesis autenticada del modelo; normalizar las fechas de tareas generales (aún usa UTC en ese bloque); resolver acceso a Supabase de Nathan y validar el ciclo de revisión real.

## v4.45 — Fechas de tareas en el chat

- Todas las comparaciones lexicográficas de `due_at` detectadas en la ruta del chat se sustituyeron por comparación de instantes. La condición 'hoy' usa día de Puerto Rico en lugar del día UTC del servidor.
- Se cubren resumen, búsqueda/listado de tareas, carga del equipo, eficiencia por cliente y tareas abiertas. Tareas completed no se marcan vencidas; fechas ausentes/ilegibles no generan plazos inventados.
- 24 pruebas focales pasan (incluye cambio de día UTC, offsets que ordenan al revés y tareas completadas), TypeScript, merge-gate y diff-check pasan. Preview simulado `/previews/v4.45-tareas-horario.html`.
- Local; no se cambiaron fechas de tareas reales. El ciclo completo de revisión/publicación y la síntesis final autenticada siguen pendientes de auditoría; acceso a Supabase de Nathan continúa pendiente.

## v4.46 — Responsables del checklist

- SELECT read-only real: 66 clientes activos, 50 con assigned_to. El generador omitía ese campo para compromisos sintéticos y solo mostraba el responsable de production_task en los videos.
- El resumen obtiene assigned_to y resuelve nombre desde perfiles ya consultados; responsable específico de tarea conserva prioridad. Si el perfil asignado no está disponible se muestra asignado/nombre no disponible, no se inventa un nombre.
- QA visual autenticada en /mi-dia#hoy: Arasibo → Carlos Villalta, Arte Digital → Lisneidy Lopez, Beyond PVC → Jeander Loop, Café El Bosque → Richard Jimenez, Casita Vieja → Alexa Kerocen; Beyond Performance sigue Sin Asignar. Arasibo conserva la confirmación de publicación externa.
- Tres regresiones fallaron antes; 21 pruebas focales, TypeScript, merge-gate y diff-check pasan. Preview simulado `/previews/v4.46-editor-checklist.html`.
- No se cambiaron asignaciones reales. Pendiente: sesiones aún sin cliente/videógrafo, migración atómica de revisión y validación completa de medios/revisión/Metricool.

## v4.47 — Middleware de Ver Como Usuario

- QA autenticada: Denisha (supervisor) era redirigida desde On Site. Inspección encontró que middleware llamaba resolveEffectiveRole sin targetRole, convirtiendo cualquier target en editor aunque layout/actions ya usaban el rol real del target.
- El middleware consulta y valida perfil destino (activo/aprobado, dueño solo consultable por dueño), aplica su rol y area_access; cookie de no-admin no habilita suplantación.
- Segunda comprobación read-only aclaró que Denisha NO tiene /onsite en area_access: la redirección sigue siendo correcta para esa ruta. Sí tiene /recording-calendar; QA visual posterior confirmó que abre Calendario de Grabación como Denisha (31 sesiones este mes, todas sin videógrafo). No se cambiaron permisos ni asignaciones reales.
- 22 pruebas focales pasan (incluye target supervisor, editor, inactivo, áreas restringidas, supervisor→owner prohibido y cookie de editor), TypeScript y merge-gate pasan.
- Supabase CLI revalidado: 16 proyectos accesibles, target bgqdtfhelknmfudcvrzz ausente. La revisión atómica continúa pendiente de acceso de Nathan.
- Preview simulado `/previews/v4.47-vista-usuario.html`. Local; auditoría global aún incompleta.

## v4.48 — Errores de carga en On Site

- La página ignoraba los errores devueltos por getOnsiteShots/getAddableIdeas y pasaba listas vacías al estudio. getAddableIdeas también confundía sesión ausente/error con sesión sin cliente.
- Ahora la página bloquea el call sheet incompleto con mensaje y enlace de recarga de la misma sesión. Un cliente no vinculado consultado correctamente sí mantiene lista vacía legítima.
- Cuatro regresiones fallaron antes; 13 pruebas focales pasan, TypeScript, merge-gate y diff-check pasan. Preview móvil simulado a 390x844 inspeccionado, sin desbordamiento horizontal, captura en public/changelog/v4.48-onsite-carga.png.
- No se indujeron fallos en datos reales ni se alteraron sesiones. El flujo completo de medios y la revisión atómica pendiente de acceso siguen abiertos.

## v4.49 — Revisión abre el día actual

- Evidencia: el tablero inicializaba siempre `DIAS[0].key` (lunes); la selección de “hoy” además omitía domingos y usaba la zona del navegador.
- Pruebas nuevas fallaron primero: martes, martes en Puerto Rico cuando UTC ya es miércoles, domingo. El cambio manual de pestaña se conserva. Las 62 pruebas anteriores se fijaron a una fecha de lunes explícita para evitar depender del reloj real.
- Se inicializa la selección y el indicador semanal con la fecha de America/Puerto_Rico. No cambia fechas guardadas ni agenda publicaciones.
- Validación: 65 pruebas del tablero; suite completa 380 archivos aprobados, 3027 pruebas aprobadas, 3 omitidas; TypeScript y merge-gate aprobados. CUA en /revision, vista Denisha Matos, confirmó Martes seleccionado y 11 piezas en Revisión. Preview móvil inspeccionado, sin desbordamiento.
- Local, sin desplegar. Sigue pendiente el acceso al proyecto de Nathan para revisión atómica y comprobar el ciclo real de medios, corrección y publicación. La síntesis previa del chat sigue mostrando datos viejos; no es evidencia de actualización actual.

## v4.50 — Cola de revisión completa y errores explícitos

- Fuente: /revision limitaba getIdeacionPipeline a 400 ideas antes de filtrar medios entregados; esa acción devolvía [] en error. Clientes y actividad de corrección también descartaban los errores.
- Nueva opción complete carga páginas de 500 con conteo exacto y orden estable created_at/id; rechaza error, conteo ausente/cambiante, duplicados y carga incompleta. Los consumidores legacy mantienen su contrato limitado. No constituye snapshot transaccional entre páginas.
- Revisión usa esa opción y muestra un aviso recuperable si falla cualquiera de sus tres consultas principales, en vez de renderizar una cola vacía o comentarios ausentes por error.
- TDD: 4 casos del loader y 3 de error de página fallaron antes del cambio. Validación final: 23 pruebas aprobadas (incluidas relaciones), TypeScript y merge-gate aprobados. CUA /revision autenticado como Denisha cargó Martes con 11 piezas en Revisión. Preview móvil inspeccionado, error simulado sin modificar datos reales.
- Local, sin publicación. Pendiente: verificar el reproductor y correcciones con medios reales; la actividad de notas aún usa una consulta limitada por el máximo del servidor, susceptible a truncamiento si crece; migración atómica sigue pendiente de acceso de Nathan. La suite completa anterior fue v4.49 (3027 aprobadas).

## v4.51 — Historial de correcciones sin truncamiento silencioso

- Fuente: la consulta única de content_idea_activity podía omitir la última nota de un video cuando las revisiones de otros videos ocupaban el máximo de filas del servidor.
- getCompleteReviewNotes usa el cliente autenticado de la página y los ids ya visibles; divide ids en grupos de 100 y resultados en páginas de 500, verifica conteos y duplicados, y conserva la nota más reciente por video. Incluye cambios internos y del cliente. Un fallo mantiene el aviso recuperable de v4.50.
- Prueba inicial falló por módulo ausente. 21 pruebas aprobadas entre consulta, selección de última nota y página; TypeScript y merge-gate aprobados. CUA confirmó /revision cargada como Denisha; preview móvil simulado inspeccionado. No se crearon comentarios ni decisiones reales para la prueba.
- Local, sin desplegar. No es snapshot transaccional de múltiples consultas. Pendiente comprobar reproducción y corrección real, y aplicar revisión atómica con acceso a Supabase de Nathan.

## v4.52 — Recuperación del visor ante rechazos de red

- QA autenticado: abrí Anibal Fuentes PNP, idea 3301450a-13ce-4fb2-8b80-3f6bc11a772e. El medio mostró un fotograma y duración 0:06; no se ha probado reproducción completa/audio. El análisis reporta ausencia de captions; la UI bloquea auto-revisión de Eric, coincidiendo con la identidad real que usa decideReview aunque se vea el rol Denisha. No se emitieron decisiones ni cambios.
- Código: ReviewOverlay y ReviewQueue no capturaban rechazos de sus promesas de consulta/firma. Se añaden captura, mensaje y reintento, con descarte de respuestas obsoletas. Al cambiar la pieza se limpian error y contenido anteriores.
- TDD: 2 fallos de overlay y 1 fallo de preview con rechazos no manejados antes del cambio. Final: 15 pruebas aprobadas, TypeScript y merge-gate aprobados; preview móvil simulado inspeccionado.
- Local, sin desplegar. Pendiente: carga de preview muestra temporalmente “Todavía no hay video editado” mientras firma; separar ese estado de un archivo ausente. Falta prueba completa de medios/correcciones/publicación y acceso de Nathan para revisión atómica.

## v4.53 — Estados de carga del medio y reproducción real

- Fuente: ReviewQueue pasaba editedUrl=null mientras esperaba la firma; InternalReviewPanel lo describía como archivo ausente. Se agrega previewState para distinguir cargando/error de archivo no subido. Aprobar continúa deshabilitado sin URL.
- Dos pruebas de regresión fallaron primero. Final: 26 pruebas de queue/panel, TypeScript y merge-gate aprobados; preview móvil de tres estados inspeccionado.
- CUA: presioné reproducir del medio de Anibal Fuentes PNP (idea 3301450a-13ce-4fb2-8b80-3f6bc11a772e) y observé cambio de fotograma y fin 0:06/0:06. No se emitió aprobación ni corrección. Audio no escuchado/validado; el análisis muestra sin captions.
- Local, sin desplegar. Próximo punto: error del elemento video luego de obtener URL todavía no tiene manejo específico ni invalida verificaciones previas; revisar antes de declarar robusta la aprobación. Sigue pendiente revisión atómica de Nathan y el ciclo real completo.

## v4.54 — Error del elemento video invalida verificaciones

- Reproducción en pruebas: un evento error del video dejaba casillas marcadas y Aprobar habilitado. Se captura el error, se desmarcan verificaciones, se bloquea Aprobar y se ofrece reintento que renueva la URL desde la cola. Cambiar video/URL también limpia las verificaciones.
- TDD: 3 regresiones fallaron antes de implementar; 29 pruebas focales aprobadas, TypeScript y merge-gate aprobados. Preview móvil simulado inspeccionado. No se dañó ni alteró un medio real para inducir el error.
- Límite: esto protege el estado del visor, no demuestra que una persona haya visto el video completo ni valida por sí mismo captions/audio. La revisión atómica y el ciclo real de corrección/publicación siguen pendientes.
- Suite completa v4.54: 384 archivos aprobados, 3055 pruebas aprobadas y 3 omitidas; salida /tmp/nate-v454-suite.log. Local, sin desplegar.

## v4.55 — Entregas lee datos completos antes de agendar

- Fuente: /entregas limitaba ideas a 400, ignoraba errores de clientes/votos/envíos y aceptaba archivos edited entregas-r2 incluso failed/archived. Ahora usa la consulta completa de ideas, el filtro canónico de entregas y readCompletePages para consultas secundarias (conteo, orden estable, detección de duplicados/cambios).
- TDD: 8 casos de página fallaron antes; helper probado desde archivo ausente. Final: 22 pruebas de página/paginación/filtro aprobadas, TypeScript y merge-gate aprobados. CUA /entregas cargó con fechas vencidas bloqueadas para Metricool; no se hizo ningún envío. Preview móvil simulado inspeccionado.
- Hallazgo pendiente real: encabezado “21 publicados” incluye tarjetas con fecha pasada y sin envío a Metricool (Arte Digital Online). No equivale a publicación verificada: corregir contador/etiqueta. También revisar elección de voto cuando hay múltiples rondas para una misma idea; hoy Object.fromEntries no elige por fecha de ronda.
- Local, sin desplegar. Paginación no es snapshot transaccional; entradas masivas de ids aún pueden requerir fragmentación. Revisión atómica de Nathan y ciclo completo real siguen pendientes.
