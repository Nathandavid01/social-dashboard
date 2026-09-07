# Auditoría del flujo a Metricool — 7 de septiembre de 2026

## Resultado operativo

**No está listo para asegurar publicación automática mañana.** Inspección de solo lectura en Supabase y Metricool para el 8–21 de septiembre, zona America/Puerto_Rico. Ningún borrador fue activado ni se enviaron publicaciones de prueba.

- 66 clientes activos; 59 perfiles conectados consultados con HTTP 200.
- Metricool: 37 publicaciones próximas, todas `draft: true`; 0 publicaciones automáticas programadas fuera de borrador en el rango.
- Dashboard: 492 ideas consultadas, ninguna fechada en ese rango. Existen piezas antiguas aprobadas, incluso descartadas con aprobación residual; no se deben reprogramar automáticamente.
- 7 clientes sin Metricool: New York, Tito Rios, Go-Kart, Danny Mudanzas, Miti Miti, Dr.Soler UltraFit Wellness Clinics y Blue Chiropractic.
- Ningún cliente activo tiene `posting_time`; el comportamiento existente usa 10:00 cuando falta. Los horarios propios de los borradores en Metricool no se modificaron.
- Ejemplo comprobado: Arasibo, post 372073193, 8 de septiembre a las 08:30 PR, `draft: true`, `autoPublish: true`, Facebook/Instagram/TikTok PENDING. Sigue siendo un borrador y no saldrá automáticamente.

| Cliente | Borradores próximos |
| --- | ---: |
| Lucky Pet | 3 |
| Ely Rosa Sportwear | 1 |
| La Guira | 2 |
| La Guarapera | 1 |
| Lumavi Properties | 1 |
| Dr. Rodriguez Caribbean Shoulder and Elbow Institute | 1 |
| Arasibo Steakhouse | 3 |
| Casita Vieja | 3 |
| Farmacia Buena Vida | 1 |
| Dorado del Mar Club | 2 |
| NutriMed | 4 |
| Mojito Mojito | 3 |
| Dra. Delian Loyola | 1 |
| Neumaticos PR | 2 |
| Pa' Ya Auto Parts Inc. | 1 |
| Pa' ya Pal Barrio | 5 |
| Panaderia La Nueva Modelo | 2 |
| Nanas Playhouse | 1 |

## Cambios locales

Rama `codex/flujo-metricool-septiembre`, basada en `github/nathan/graphic-designing` / `github/main` en `5ffaef4`. No afecta el checkout de Arasibo.

1. La frontera compartida `runIdeaPost` valida fecha y hora PR antes del claim o POST. Rechaza fechas ausentes/vencidas, horarios inválidos, margen inferior a 5 minutos y piezas descartadas. Un cambio manual válido sigue siendo explícito.
2. Aprobar conserva una fecha existente. No mueve contenido viejo a un nuevo día; el operador debe revisar la pieza y elegir fecha.
3. Pruebas del contrato existente del archivo aprobado: el envío utiliza el archivo de Entregas sellado, el perfil específico del cliente y `autoPublish: true`.
4. Los errores de Metricool se devuelven al llamador de aprobación. No se silencian como `null`.
5. Reconciliación distingue `draft` de `scheduled`. La interfaz deja de prometer un traslado automático a +24 horas y desactiva envíos con fecha inválida.
6. Panel de solo lectura en `/published`, con permiso `metricool.read`: consulta mañana +14 días por cliente, separa borradores/programados/atención y marca fallos de consulta como sin verificar. Límite de concurrencia, timeout y sin caché de respuestas de Metricool.

## Validación

- Suite completa: **2829 pruebas pasaron**, 3 omitidas (staging), 339 archivos pasaron y 1 omitido.
- `npx tsc --noEmit`: limpio.
- `npm run merge-gate`: los tres nodos pasaron, incluido inventario R2 de solo lectura.
- `git diff --check`: limpio.
- Vista previa del componente real con acción sustituida por datos de ejemplo: 390 × 844 y 1440 × 1000, sin desbordamiento horizontal ni errores de consola.
- Vista previa: `/previews/v4.9-flujo-metricool.html`; captura: `/changelog/v4.9-flujo-metricool.png`.
- No se ejecutó build sobre `.next` mientras el servidor de desarrollo está activo.
- La ruta real requiere autenticación: no se afirma QA visual autenticada ni un POST real exitoso. Las pruebas de envío simulan Metricool.

## Pendiente para operar mañana

- Confirmar cuáles borradores tienen aprobación final de los clientes. Pregunta enviada al usuario; sin respuesta al cerrar esta auditoría.
- Revisar cada pieza aprobada (video, copy, redes, fecha y hora), vincularla con su trabajo del dashboard y activar únicamente los envíos autorizados. No recrear posts que ya existen en Metricool.
- Conectar los 7 clientes faltantes con sus perfiles correctos. No usar el perfil global como sustituto.
- Preparar fechas y responsables en el dashboard para el trabajo nuevo. No transformar el backlog de agosto en el calendario nuevo por defecto.
- Publicar estos cambios mediante PR y revisión según `docs/MERGE_RULES.md`, luego probar el flujo autenticado en el despliegue real. Los cambios no están desplegados.
- El proyecto Vercel `social-dashboard` existe en la cuenta Eric; la inspección de `social-dashboard-zeta-orpin.vercel.app` no encontró su deployment en esa cuenta. No se sustituyó el sitio con otro despliegue.
- La configuración de cron local solo muestra sync/planificación/mantenimiento; no hay worker de reintentos de publicación. La cadena depende de los disparadores de aprobación/copy o envío manual; no se promete recuperación automática de fallos.
- Después de la hora programada, verificar estado PUBLISHED por red y URL pública. Programado/enviado no equivale a publicado.

Auditoría redactada: 2026-09-07T11:20:09.458349+00:00 UTC. Los datos operativos pueden cambiar; repetir la consulta antes de activar publicaciones.
