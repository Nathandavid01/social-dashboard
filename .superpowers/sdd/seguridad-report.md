# Reporte — cierre de huecos de seguridad (auditoría, v3.48)

Worktree: `/Users/ericperez/Nate Media/sd-seguridad`
Rama: `eric/cerrar-huecos` (desde `main`, sin push)

## Status: COMPLETO — los 3 huecos cerrados, TDD, todo verde. Incluye la corrección de la revisión de seguridad sobre el impacto en `onsite` (ver "Corrección post-revisión" abajo).

## Commits (6, en orden)

1. `520c5e2` — security: crons exigen CRON_SECRET real, sin fallback por header
2. `b626202` — security: descargas del pipeline piden permiso (getR2DownloadUrl/PublicUrl/PreviewUrl)
3. `b04f5e3` — security: solo se aceptan y sirven tipos de video en el pipeline (XSS almacenado)
4. `e740a77` — chore: v3.48 + CHANGELOG
5. (reporte) — docs: reporte de cierre de seguridad
6. `fix(permisos): ver y bajar lo que uno mismo subió` — corrección post-revisión (excepción de autoría + UI que no miente)

## Resumen de tests (tras la corrección post-revisión)

- `npx tsc --noEmit` → limpio
- `npm run check:db-relationships` → OK, sin regresión de embeds
- `npx vitest run app/api/ lib/actions/ components/recording/ components/auth/ --exclude '**/.claude/**'` → **317 passed, 3 skipped** (37 archivos)
- `npx vitest run --exclude '**/.claude/**'` (suite completa) → **2174 passed, 3 skipped** (252 archivos)

Archivos de test nuevos/tocados: `lib/auth/cron.test.ts`, `app/api/cron/{metricool-sync,plan-week,ui-events-prune,video-health}/route.test.ts`, `lib/utils/video-upload-guard.test.ts`, `app/api/video-file/[videoId]/route.test.ts` (extendido), `lib/actions/idea-videos-r2.test.ts` (extendido), `lib/actions/entregas-r2.test.ts` (nuevo), `app/api/client-upload/presign/route.test.ts` (nuevo), `components/auth/role-gate.test.tsx` (nuevo), `components/recording/idea-video-panel.test.tsx` (extendido).

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

- `getR2DownloadUrl`, `getR2PublicUrl` y `getR2PreviewUrl` (`lib/actions/idea-videos-r2.ts`) ahora exigen el mismo gate que `getEntregasPreviewUrl`: `revision.read || entregas.read || planning.read`, **con una excepción: quien subió el archivo (`uploaded_by`) siempre puede verlo/bajarlo**, sin necesitar ese permiso (ver "Corrección post-revisión" abajo — el gate puro, sin esta excepción, rompía un caso de uso real).
- `getR2PublicUrl` **no tiene ningún caller en producción hoy** (solo tests y referencias en docs/infra) — gatearla es costo cero.
- `getR2DownloadUrl`/`getR2PreviewUrl` se usan desde `editor-video-card.tsx` (board de pipeline: supervisor/editor/disenador, todos con `revision.read`) y `idea-video-panel.tsx`/`copy-overlay.tsx`/`review-queue.tsx` (Entregas/revisión: mismos roles con `entregas.read`/`revision.read`) → sin regresión.
- `copy` y `team_member` **retienen** acceso a través del gate (tienen `entregas.read`/`revision.read` o `planning.read` respectivamente) — es el comportamiento pedido por el gate especificado, no un descuido.

## Corrección post-revisión — mi evaluación original del impacto en `onsite` estaba INCOMPLETA

La revisión de seguridad (`code-review`) encontró que mi reporte original subestimaba el impacto real:

1. **No solo se perdía "Bajar" — también "Ver"** (`togglePreview` → `getVideoPreviewUrl` → `getR2PreviewUrl`, gateado igual).
2. **Los dos botones seguían VISIBLES**: `idea-video-panel.tsx` los mostraba solo por `storage_provider === 'r2'`, sin mirar permisos. El videógrafo los veía, los pulsaba, y recibía un toast de "No autorizado" en cada grabación propia — la pantalla parecía **rota**, no restringida. Mi versión original ("pierde el botón") no era lo que iba a pasar en producción; lo que iba a pasar era un botón visible que siempre falla.

**Arreglo aplicado — "permitir siempre lo propio":**

- `getR2DownloadUrl`, `getR2PreviewUrl` y `getR2PublicUrl` (`lib/actions/idea-videos-r2.ts`) ahora conceden acceso si (a) el gate de permisos pasa, **o** (b) `content_idea_videos.uploaded_by === auth user id`. Se resuelve el usuario una sola vez (`supabase.auth.getUser()`) y se compara contra el `uploaded_by` de la fila que ya se leía para sacar el `drive_file_id` — sin consulta extra por llamada. Cuando es dueño, ni siquiera se llama a `currentUserHas` (corto-circuito).
- **La UI ya no miente**: en `idea-video-panel.tsx`, "Ver" y "Bajar" ahora se renderizan solo si `canManageVideos` (el mismo gate, vía nuevo hook `useHasAnyPermission`) **o** `video.uploaded_by === currentUserId` (nuevo hook `useCurrentUserId`, ambos en `components/auth/role-gate.tsx`). Se calcula una vez en `IdeaVideoPanel` y baja por props (`canManageVideos`, `ownUploadUserId` → `canSee` en `FileRow`) — sin fetch nuevo por fila.
- Resultado real para el videógrafo (`video`): sigue viendo y bajando **su propia grabación** en `onsite`; ya no puede tocar el material crudo de otro cliente — que era el objetivo real del cierre.

**Tests añadidos**: `lib/actions/idea-videos-r2.test.ts` (dueño sin permiso → funciona; tercero sin permiso → sigue negado; sin sesión → sigue negado; con permiso normal → sin cambio), `components/auth/role-gate.test.tsx` (nuevo, para `useHasAnyPermission`/`useCurrentUserId`), `components/recording/idea-video-panel.test.tsx` (con permiso muestra ambos botones aunque el video sea de otro; sin permiso pero propio muestra ambos; sin permiso y ajeno NO renderiza ninguno; sin sesión NO renderiza ninguno).

## Concerns / seguimientos

1. **Mismo patrón de "botón visible que siempre falla" en `editor-video-card.tsx`** (usado en `app/(dashboard)/video-reviews/page.tsx`, cuyo único gate de página es `video.upload`, no un permiso de lectura): su botón "Bajar" también llama a `getR2DownloadUrl` sin mirar permiso ni autoría antes de renderizarse. No lo toqué — la corrección pedida fue específicamente para `idea-video-panel.tsx`/`onsite` — pero es candidato al mismo arreglo (`canSee` por props) si algún rol sin `revision.read`/`entregas.read`/`planning.read` llega a esa pantalla.
2. El default de `POST /api/client-upload/presign` cuando `contentType` viene vacío sigue siendo `video/mp4` (compatibilidad con el flujo actual del portal) — ya pasa la whitelist, no es un hueco, pero queda documentado por si se prefiere exigir `contentType` explícito en el futuro.
3. No se tocó `vercel.json` — no hace falta cambio ahí, solo la verificación de la variable de entorno descrita arriba.
4. El único cambio visible de todo este trabajo es que "Ver"/"Bajar" dejan de aparecer cuando no aplican (documentado en CHANGELOG v3.48) — el resto es interno, sin preview HTML.
