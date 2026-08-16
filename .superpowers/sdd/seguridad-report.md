# Reporte — cierre de huecos de seguridad (auditoría, v3.48)

Worktree: `/Users/ericperez/Nate Media/sd-seguridad`
Rama: `eric/cerrar-huecos` (desde `main`, sin push)

## Status: COMPLETO — los 3 huecos cerrados, TDD, todo verde.

## Commits (4, en orden)

1. `520c5e2` — security: crons exigen CRON_SECRET real, sin fallback por header
2. `b626202` — security: descargas del pipeline piden permiso (getR2DownloadUrl/PublicUrl/PreviewUrl)
3. `b04f5e3` — security: solo se aceptan y sirven tipos de video en el pipeline (XSS almacenado)
4. `e740a77` — chore: v3.48 + CHANGELOG

## Resumen de tests

- `npx vitest run app/api/ lib/actions/ --exclude '**/.claude/**'` → **256 passed, 3 skipped** (29 archivos)
- `npx tsc --noEmit` → limpio
- `npm run check:db-relationships` → OK, sin regresión de embeds
- `npx vitest run --exclude '**/.claude/**'` (suite completa) → **2160 passed, 3 skipped** (251 archivos)

Archivos de test nuevos/tocados: `lib/auth/cron.test.ts`, `app/api/cron/{metricool-sync,plan-week,ui-events-prune,video-health}/route.test.ts`, `lib/utils/video-upload-guard.test.ts`, `app/api/video-file/[videoId]/route.test.ts` (extendido), `lib/actions/idea-videos-r2.test.ts` (extendido), `lib/actions/entregas-r2.test.ts` (nuevo), `app/api/client-upload/presign/route.test.ts` (nuevo).

## Hueco 1 — cron de Metricool sin autorización real

- Nuevo `lib/auth/cron.ts` (`cronAuthDenial`), compartido por las 4 rutas bajo `app/api/cron/*` (metricool-sync, plan-week, ui-events-prune, video-health — las 4 tenían el mismo patrón laxo, no solo la mencionada).
- Regla: **solo** `Authorization: Bearer <CRON_SECRET>` autoriza. Se eliminó el fallback `x-vercel-cron`.
- Si `CRON_SECRET` no existe en el entorno → **503, cero efectos** (falla cerrado).
- Tests cubren: sin cabecera → 401 + cero llamadas a Metricool/Supabase; `x-vercel-cron` solo → 401 (regresión explícita del hallazgo); secreto incorrecto → 401; secreto correcto → ejecuta; sin `CRON_SECRET` → 503 + cero llamadas.

**Verificar en el panel de Vercel para que los crons sigan corriendo:**
Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>` en sus invocaciones programadas **solo si** el proyecto tiene la variable `CRON_SECRET` configurada en **Project Settings → Environment Variables → Production**. Checklist:
1. Confirmar que `CRON_SECRET` existe en el entorno **Production** del proyecto de Nathan en Vercel (no solo Preview/Development).
2. Tras el próximo deploy, revisar el panel **Cron Jobs** (o los logs de cada invocación) y confirmar que las 4 rutas devuelven 200 en su corrida programada.
3. Si `CRON_SECRET` faltara, las 4 rutas responderán 503 en cada corrida — visible como fallo en los logs de cron de Vercel, no como error silencioso.

## Hueco 2 — Content-Type sin validar (XSS almacenado)

- Nuevo `lib/utils/video-upload-guard.ts`: helper puro compartido, whitelist `video/*` (cubre mp4, quicktime/mov, webm y variantes de dispositivo como `video/x-m4v`), normaliza mayúsculas y descarta el `;codecs=...`. Vacío/no-video → rechazado (falla cerrado).
- **Al subir**, ahora valida contra esa whitelist en **las 4** rutas que presignan subida de video (una más de las 3 pedidas):
  - `getR2UploadUrl` y `getQuickUploadUrl` (`lib/actions/idea-videos-r2.ts`)
  - `getEntregasUploadUrl` (`lib/actions/entregas-r2.ts`)
  - `POST /api/client-upload/presign` (`app/api/client-upload/presign/route.ts`) — **la ruta del portal de cliente, hallada durante la investigación**: es anónima (magic link, sin sesión de equipo) y presignaba con el `contentType` tal cual lo mandaba el navegador, sin validar nada. Es el vector más expuesto de los cuatro porque no requiere ni siquiera una cuenta del equipo.
  - (`video-thumbs.ts` y `pipeline-submit.ts` se revisaron: no necesitan cambio — el primero fija su `ContentType` en servidor a `image/jpeg` fijo, sin tomarlo del cliente; el segundo no presigna nada.)
- **Al servir**, `app/api/video-file/[videoId]/route.ts` ya no confía en el `Content-Type` guardado: lo pasa por la misma whitelist (`safeServeContentType`), y si no matchea sirve `application/octet-stream` + `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment`. Streaming y Range de un mp4 normal quedan intactos (tests de regresión explícitos).

## Hueco 3 — descargas del pipeline sin permiso

- `getR2DownloadUrl`, `getR2PublicUrl` y `getR2PreviewUrl` (`lib/actions/idea-videos-r2.ts`) ahora exigen el mismo gate que `getEntregasPreviewUrl`: `revision.read || entregas.read || planning.read`.
- Investigación de impacto en caminos legítimos:
  - `getR2PublicUrl` **no tiene ningún caller en producción hoy** (solo tests y referencias en docs/infra) — gatearla es costo cero.
  - `getR2DownloadUrl`/`getR2PreviewUrl` se usan desde `editor-video-card.tsx` (board de pipeline: supervisor/editor/disenador, todos con `revision.read`) y `idea-video-panel.tsx`/`copy-overlay.tsx`/`review-queue.tsx` (Entregas/revisión: mismos roles con `entregas.read`/`revision.read`) → **sin regresión**.
  - **Concern real**: `idea-video-panel.tsx` se usa también en `app/(dashboard)/onsite/page.tsx` (gate `recording.read`), la pantalla de grabación del rol **`video`**. El botón "Bajar" ahí ya NO funcionará para ese rol después de este fix, porque `video` no tiene `revision.read`/`entregas.read`/`planning.read` — es exactamente el resultado que pide la auditoría (ese rol no debería poder descargar material de cualquier cliente), pero es una regresión de UX visible: el videógrafo pierde el botón de descarga de su propia grabación recién subida. No lo ajusté sin decisión de producto — si se quiere mantener esa descarga para `video`, hace falta un permiso más angosto (p.ej. "descargar mi propia grabación") en vez de reabrir el gate compartido.
  - `copy` y `team_member` **retienen** acceso a través del gate (tienen `entregas.read`/`revision.read` o `planning.read` respectivamente) — es el comportamiento pedido por el gate especificado, no un descuido.

## Concerns / seguimientos

1. **Botón "Bajar" en `onsite` para el rol `video`** (arriba) — decisión de producto pendiente: ¿permiso nuevo más angosto, o aceptar la pérdida del botón?
2. El default de `POST /api/client-upload/presign` cuando `contentType` viene vacío sigue siendo `video/mp4` (compatibilidad con el flujo actual del portal) — ya pasa la whitelist, no es un hueco, pero queda documentado por si se prefiere exigir `contentType` explícito en el futuro.
3. No se tocó `vercel.json` — no hace falta cambio ahí, solo la verificación de la variable de entorno descrita arriba.
4. Sin preview HTML (cambio interno, sin UI visible) — así lo pidió la tarea.
