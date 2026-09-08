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
