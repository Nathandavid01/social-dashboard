# Subida resistente — reporte

> ⚠️ **PRERREQUISITO OBLIGATORIO ANTES/A LA VEZ DEL MERGE**: aplicar
> `supabase/migrations/0065_multipart_uploads_ownership.sql`. Sin ella, la subida por partes
> (archivos de 8 MB+) NO funciona — falla con un error controlado y en español ("falta una
> actualización pendiente en la base de datos"), no con un huérfano en R2 ni un mensaje técnico, pero
> falla igual. A diferencia de las demás migraciones de este repo (que degradan suave), esta es
> bloqueante para la feature. Detalle en el Addendum, sección 2 y 3, más abajo.

## Status

Completo para `idea-video-panel.tsx` (donde Eric lo pidió). `editor-video-card.tsx` y
`components/pipeline/use-submit-videos.ts` (Entregas) quedan **intactos, en el flujo
antiguo (PUT directo, un solo XHR)** — migrarlos era parte opcional del pedido ("si eso
resulta demasiado en un solo cambio, migra primero idea-video-panel.tsx y deja los otros
funcionando como hoy"). No quedaron a medias: siguen 100% funcionales tal cual estaban.

## Commits (worktree `eric/subida-resistente`, sin push)

1. `10f569d` — Motor de subida resistente: partes, reintentos y store global
   - `lib/utils/upload-parts.ts` — cálculo puro de partes (8 MB), backoff exponencial + jitter, agregación de progreso
   - `lib/utils/upload-http.ts`, `lib/utils/sleep.ts` — PUT vía XHR con abort, delay inyectable
   - `lib/actions/multipart-upload.ts` — crear/firmar (en lote)/completar/abortar multipart, mismo gate `requirePermission('video.upload')`, mismo enrutado dual-R2 (`r2` / `entregas-r2`)
   - `lib/stores/upload-store.ts` — el motor vive en zustand, no en un componente
2. `69047a6` — Indicador global: `components/uploads/nate-upload-logo.tsx` (N que se llena) + `components/uploads/upload-dock.tsx` (esquina inferior izquierda, `beforeunload`), montado en `app/(dashboard)/layout.tsx`
3. `784dad1` — `idea-video-panel.tsx` migrado al motor nuevo; UI de progreso reemplazada por logo+fase leídos del store; `lib/utils/upload-phase-text.ts` (copy compartido dock/panel)
4. `11395be` — versión 3.47, `CHANGELOG.md`, `public/previews/v3.47-subida-resistente.html`

## Resumen de tests (todos nuevos, TDD)

- `lib/utils/upload-parts.test.ts` — 14 tests: partes exactas/con resto/archivo chico/cero bytes, contigüidad, umbral multipart, backoff (crece, acotado por `maxMs`, jitter nunca negativo), agregación de progreso (0%/50%/100%/clamp).
- `lib/actions/multipart-upload.test.ts` — 7 tests: gate `video.upload`, enrutado r2 vs entregas-r2 (cliente y prefijo de key correctos, nunca se cruzan), presign en lote, complete con ETags ordenados, abort, mensaje en español si el bucket no está configurado.
- `lib/stores/upload-store.test.ts` — 7 tests: archivo chico feliz (r2 y entregas-r2 por separado), raw/broll NO dispara análisis IA, una parte falla 2 veces y se recupera (`attempt` ≥ 3, sube igual), se agotan los 5 intentos → `error`, NO registra el video, SÍ llama `abortMultipartUpload`, cancelar aborta en vuelo + llama abort del servidor, y un test explícito de que el store avanza de fase sin que ningún componente esté montado.
- `components/uploads/nate-upload-logo.test.tsx` — 6 tests: geometría del rect de clip en 0/50/100%, clamp fuera de rango, transición presente con movimiento permitido, `transition: none` bajo `prefers-reduced-motion` (con el relleno igual reflejando el %).
- `components/uploads/upload-dock.test.tsx` — 9 tests: oculto sin subidas, aparece con una activa y su %, cuenta "N subidas", cada fase tiene su texto, cancelar llama al store, cerrar quita del dock, `beforeunload` avisa solo con subidas activas.
- `lib/utils/upload-phase-text.test.ts` — 4 tests: texto por fase (incluye parte X de Y solo si es multipart), mensaje de error.
- `components/recording/idea-video-panel.test.tsx` — las 23 pruebas existentes se mantienen en verde (adapté el helper `flush()` para drenar la cadena de promesas más larga del motor nuevo, y completé el stub `FakeXHR` de las pruebas con `getResponseHeader` que le faltaba — sin eso el PUT fallaba silenciosamente contra el mock).

Totales: `npx vitest run --exclude '**/.claude/**'` → **249 archivos, 2152 tests, todos en verde** (0 fallos, 0 skips relevantes, sin warnings de `act()`). `npx tsc --noEmit` limpio. `npm run check:db-relationships` OK.

## Concerns / decisiones que tomé sin preguntar (documentadas para que las revises)

1. **CORS**: no hizo falta tocar nada — el PUT de cada parte multipart va al mismo bucket/dominio presignado que ya usan los PUT de hoy (`getR2UploadUrl`/`getEntregasUploadUrl`), solo que ahora también con `UploadPartCommand`. Si el bucket ya acepta el PUT directo de hoy, acepta el de partes igual.
2. **`processUploadedVideo` ahora se espera (`await`) dentro del motor**, no "fire-and-forget" como antes — necesario para poder mostrar la fase `analizando` de forma honesta y transicionar a `listo` después. Si el análisis falla, el error se traga (la subida ya está completa y registrada) y de todos modos pasa a `listo`.
3. **Auto-abort en cualquier error, no solo en cancelar**: si una parte agota sus 5 intentos, el motor llama `abortMultipartUpload` igual que en cancelar, para no dejar partes huérfanas pagando almacenamiento — el pedido lo mencionaba explícitamente solo para "cancelar", lo extendí a "error" por el mismo motivo de fondo.
4. **Dock en la esquina inferior IZQUIERDA** (el chat ya ocupa `bottom-4 right-4`) — evita cualquier solape sin necesitar coordinar tamaños dinámicos.
5. **Items terminados (`listo`/`cancelado`) no se auto-eliminan del dock/panel** — quedan hasta que el usuario los cierra con el botón "Cerrar"/"×". No implementé un temporizador de auto-limpieza para no dejar timers sueltos que compliquen las pruebas; si Eric prefiere que desaparezcan solos después de unos segundos, es un cambio pequeño y aislado en `upload-store.ts`.
6. **Concurrencia de partes = 3, tamaño de parte = 8 MB fijo, reintentos = 5** — tal cual pedidos, no configurables por ahora.

## Addendum — revisión final: 3 hallazgos atendidos

### 1 (CRITICAL) — cancelar en "preparando" dejaba multipart huérfano — RESUELTO

`lib/stores/upload-store.ts`: `Engine.cancelled` se marca **síncronamente** dentro de `cancelUpload`,
antes de abortar/patchear, porque `startMultipartUpload` no está atada al `AbortController` y puede
resolver después del cancel. `runMultipart` comprueba el flag justo tras asignar `uploadId`/`key` y
aborta ahí si hace falta. Centralicé el abort server-side en `abortServerSideOnce(id)` (con flag
`serverAborted` para idempotencia), llamada desde los tres sitios que pueden competir: `cancelUpload`,
el chequeo en `runMultipart`, y el catch de `runEngine`. Nunca se dispara dos veces.

Tests nuevos en `lib/stores/upload-store.test.ts`: cancelar durante `preparando` con
`startMultipartUpload` resolviendo *después* del cancel → `abortMultipartUpload` se llama exactamente
una vez, con el `uploadId`/`key` que llegaron tarde; cancelar ya en `subiendo` → sigue abortando una
sola vez (antes no había ninguna aserción de "exactamente una vez").

### 2 (Important) — nadie validaba que el uploadId fuera tuyo — RESUELTO (con migración)

Implementé la opción completa, no a medias: `supabase/migrations/0065_multipart_uploads_ownership.sql`
crea `multipart_uploads` (`upload_id` PK, `key`, `idea_id`, `provider`, `created_by`, `created_at`) con
RLS `created_by = auth.uid()` en insert/select/delete — **Postgres es el gate de identidad**, no una
comparación manual en el código de la acción. `startMultipartUpload` registra la fila al crear el
multipart (y si el insert falla, aborta el multipart recién creado en R2 en vez de dejarlo sin rastro).
`presignUploadParts`, `completeMultipartUpload` y `abortMultipartUpload` verifican con `ownsUpload()`
antes de tocar R2 — un `uploadId`/`key` ajeno, aunque se conozca exacto, resuelve como "no encontrado"
porque RLS ya filtró la fila. Al completar/abortar con éxito se borra la fila (`clearOwnership`).

Tests nuevos en `lib/actions/multipart-upload.test.ts` (13 en total ahora): registro de dueño al crear,
abort del multipart si el insert de ownership falla, presign/complete/abort exitosos para el dueño,
y **refusal explícito para un usuario distinto** en los tres — sin tocar R2 en ese caso (aserción de
que `r2Send` no se vuelve a llamar más allá del create original).

Si prefieres NO cargar esta migración en este PR, dímelo y la separo a una rama/PR aparte — quedó
autocontenida (una sola tabla nueva, sin tocar `content_ideas` ni ninguna existente) para que sea fácil
de aislar si así lo decides.

### 3 (Important) — sin limpieza de multiparts abandonados — RESUELTO (cron + nota operativa)

- `lib/utils/multipart-sweep-core.ts` (+ test): regla pura "más de 24h desde `Initiated` = abandonado".
- `app/api/cron/multipart-sweep/route.ts`: mismo patrón `CRON_SECRET`/`x-vercel-cron` que los crons
  existentes (`app/api/cron/*`). Lista (`ListMultipartUploadsCommand`) y aborta los multiparts
  abandonados en **ambos** buckets (r2 y entregas-r2, por separado — respeta el split dual-R2), y
  limpia filas de `multipart_uploads` más viejas que el corte (con service role, bypassa RLS).
- `vercel.json`: registrado, `45 8 * * *` (diario, después de los demás crons de la mañana).
- **Pendiente operativo explícito** (documentado en `CHANGELOG.md` v3.47, no bloqueante): cada bucket
  de R2 (`nmedia-videos` y el de Entregas) necesita además la regla de lifecycle nativa
  `AbortIncompleteMultipartUpload` como segunda capa — se configura UNA VEZ, a mano:
  **Cloudflare dashboard → R2 → el bucket → Settings → Object lifecycle rules → "Abort incomplete
  multipart uploads" → 1 día** (o el equivalente vía Wrangler/API de R2, que a la fecha no tiene un
  comando dedicado en el CLI de Cloudflare — se hace vía el dashboard o la API S3 de R2 con
  `PutBucketLifecycleConfiguration`). El cron es la primera capa (activa, corre ya); esta regla es la
  red de seguridad nativa del proveedor y **no la metí** porque es configuración de infraestructura
  fuera del repo, no código — la dejo explícita para que se aplique a los dos buckets.

### Minor — flicker de fase y % congelado — RESUELTOS (salieron baratos)

- La fase agregada ahora se deriva de un `Set` de partes actualmente reintentando
  (`retryingParts`), no del último part que patcheó el store — "reintentando" se mantiene estable
  mientras CUALQUIER parte esté en backoff, sin importar que otras partes sigan dequeueándose y
  arrancando su primer intento (que antes pisaba la fase de vuelta a "subiendo").
- Al marcar una parte como reintentando se descartan sus bytes en vuelo del agregado de progreso EN
  ESE MOMENTO, no en el primer evento de progreso del reintento — el % ya no queda inflado/congelado
  con datos de una parte que en realidad reinicia desde 0.
- Tests nuevos: `reintentando` aparece una sola vez en la secuencia de fases con 5 partes/concurrencia
  3 (el escenario que exhibía el parpadeo); el % en el primer instante de `reintentando` no excede la
  proporción de las partes sanas.

### Verificación tras el addendum

`npx tsc --noEmit` limpio · `npm run check:db-relationships` OK · suite completa
`npx vitest run --exclude '**/.claude/**'` → **250 archivos, 2166 tests, todos en verde**.

Commits nuevos: `c0aa757` (fix crítico + minors), `221e46e` (ownership + migración), `e71a3a4`
(cron sweep + nota operativa).

## Addendum 2 — segunda revisión: 2 hallazgos + refuerzo de visibilidad del prerrequisito

### 1 — el cron nuevo repetía el hueco de `x-vercel-cron` falsificable — RESUELTO

`app/api/cron/multipart-sweep/route.ts` exigía **siempre** `Authorization: Bearer $CRON_SECRET`
ahora — quité por completo el fallback `x-vercel-cron` (esa cabecera la pone el llamador, es
falsificable con un `curl` cualquiera, y es justo lo que otra auditoría explotó en producción contra
los 5 crons viejos). Si `CRON_SECRET` no está en el entorno, la ruta responde **503 y no ejecuta
nada** (falla cerrado) — antes, sin secreto configurado, la comprobación completa dependía solo de la
cabecera forjable. No toqué los otros 5 crons (`metricool-sync`, `plan-week`, `ui-events-prune`,
`video-health`) — otra rama los está arreglando, para evitar conflictos.

Tests nuevos en `app/api/cron/multipart-sweep/route.test.ts` (5): sin cabecera → 401, cero llamadas a
R2/Supabase; con `x-vercel-cron` SOLO (sin Bearer) → 401 (la vía falsificable ya no sirve); con Bearer
incorrecto → 401; con Bearer correcto → 200 y sí ejecuta; sin `CRON_SECRET` en el entorno (aunque
venga un Bearer) → 503 y cero ejecución.

### 2 — sin la migración 0065, el usuario veía un error técnico en inglés y una mentira de permisos — RESUELTO

`lib/actions/multipart-upload.ts`:
- `isMissingOwnershipTable(error)` detecta el caso concreto (código Postgres `42P01`, o el mensaje
  `relation "...multipart_uploads..." does not exist`) sin depender de un mensaje exacto frágil.
- `recordOwnership` (usada en `startMultipartUpload`): si el insert falla por tabla ausente, devuelve
  `"No se pudo iniciar la subida: falta una actualización pendiente en la base de datos. Avisa al
  equipo."` en vez del texto crudo de Postgres. El abort del multipart recién creado en R2 (ya
  verificado como correcto en la revisión anterior) sigue intacto — no queda huérfano.
- `checkOwnership` (nueva; reemplaza el booleano ciego de `ownsUpload`) devuelve
  `{ owns: boolean } | { error: string }` — distingue "verifiqué y NO eres el dueño" de "no pude
  verificar nada". `presignUploadParts`, `completeMultipartUpload` y `abortMultipartUpload` ahora
  propagan el `error` de infraestructura tal cual, y solo dicen "No autorizado para esta subida"
  cuando de verdad se verificó que la fila pertenece a otro usuario.

Tests nuevos en `lib/actions/multipart-upload.test.ts` (ahora 17 en total): `startMultipartUpload`
con tabla ausente → mensaje en español, sin texto de Postgres, con el abort de R2 igual de invocado
que en el resto de fallos de ownership; y un caso por acción (presign/complete/abort) donde la
verificación falla por tabla ausente → el mensaje nunca es `'No autorizado para esta subida'`, siempre
menciona "actualización pendiente" — y complete/abort JAMÁS tocan R2 en ese caso (el `create` original
es la única llamada contada).

### 3 — visibilidad del prerrequisito — REFORZADA

Añadido un bloque `⚠️` justo al abrir `## v3.47` en `CHANGELOG.md` (antes del título en negrita) y
otro al principio de este reporte, explicando que, a diferencia de las demás migraciones del repo,
esta es bloqueante: sin `0065` aplicada, la subida por partes falla (con mensaje limpio, no un
huérfano ni un error técnico — pero falla).

### Verificación tras este addendum

`npx tsc --noEmit` limpio · `npm run check:db-relationships` OK · suite completa
`npx vitest run --exclude '**/.claude/**'` en verde (ver conteo final abajo).

Commits nuevos de esta ronda: fix del cron (auth fail-closed + tests), mensajes de ownership en
español (infra vs. permisos + tests), refuerzo de visibilidad del prerrequisito en CHANGELOG/reporte.

## Pendiente explícito (no a medias, sino fuera de alcance por decisión de Eric)

- `components/video-pipeline/editor-video-card.tsx` y `components/pipeline/use-submit-videos.ts`
  (formulario de Entregas) siguen con PUT directo de un solo XHR, sin reintento por parte ni
  store global. Ambos comparten las mismas acciones de servidor que ya usa el motor nuevo
  (`getR2UploadUrl`/`registerR2Video`, `getEntregasUploadUrl`/`registerEntregasVideo`), así que
  migrarlos después es mecánico: reemplazar su `uploadOne`/`handleFiles` por
  `useUploadStore().startUpload(...)` igual que se hizo en `idea-video-panel.tsx`.
