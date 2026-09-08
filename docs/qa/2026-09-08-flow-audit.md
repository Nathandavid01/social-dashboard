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
