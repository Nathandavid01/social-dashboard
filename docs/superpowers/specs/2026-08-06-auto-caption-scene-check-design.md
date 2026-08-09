# Auto-caption al subir video + verificación de subtítulos con Grok visión

**Fecha:** 2026-08-06 · **Estado:** aprobado por Eric (enfoque A)

## Objetivo

Dos automatizaciones que corren al subir el video editado a una tarjeta del pipeline:

1. **Caption automático** — si la tarjeta no tiene caption, se genera solo con Grok
   (el proveedor ya integrado en `lib/llm/caption-llm.ts`), sin que nadie toque el botón.
2. **Verificación de subtítulos + cliente ("scene check")** — Grok con visión revisa frames del
   video, reporta **errores de ortografía y gramática** en los textos en pantalla y clasifica
   si el contenido corresponde al cliente (`match` / `mismatch` / `uncertain`).
   El resultado es un **aviso en la tarjeta** — nunca bloquea el flujo.

## Decisiones cerradas (con Eric)

- Proveedor de visión: **Grok (xAI)** — misma API key `XAI_API_KEY` ya configurada.
- Trigger: **al subir el video editado** (flujo R2 del dashboard web).
- Criterio de texto: **solo ortografía/gramática** del texto en pantalla (español).
  No valida legibilidad (fase futura si hace falta).
- Ampliación 2026-08-08: también compara el video con el nombre, industria, voz de marca
  y contexto creativo del cliente. Si no hay evidencia visual suficiente, devuelve
  `uncertain`; nunca fuerza un sí/no.
- Resultado: **solo avisar en la tarjeta**. No bloquea envío a revisión ni notifica.
- Caption automático **solo si `generated_caption` está vacío** — nunca sobrescribe.
- Si la tarjeta no tiene "¿de qué es este video?" (`isIdeaReadyForCaption` falla),
  el caption se genera usando **lo que Grok ve en los frames** como tema.

## Arquitectura (enfoque A: frames capturados en el navegador)

La API de Grok acepta imágenes, no video. Los frames se capturan en el navegador
en el momento de la subida — cero infraestructura nueva (no hay ffmpeg en Vercel).

```
[navegador]                          [server actions]                [Grok API]
subir video a R2 (flujo actual)
  └─ capturar 8–12 frames             registerR2Video (actual)
     <video> oculto + canvas   ──►    + analyzeUploadedVideo (nuevo)
     JPEG ~720px, repartidos            ├─ Grok visión: leer texto      chat/completions
     por la duración                    │  en pantalla + marcar         (modelo visión)
                                        │  errores de ortografía
                                        ├─ guardar reporte en
                                        │  content_idea_videos.scene_check (jsonb)
                                        └─ si no hay caption:
                                           generateIdeaCaption (actual)
                                           con tema = idea o descripción
                                           de los frames
```

### Componentes

**1. `lib/utils/video-frames.ts` (cliente, lógica pura + DOM)**
- `captureVideoFrames(file: File, count = 10): Promise<Blob[]>` — carga el archivo
  en un `<video>` oculto, hace seek a `count` puntos equidistantes (evitando el
  frame 0 y el último medio segundo), dibuja en canvas y exporta JPEG (máx 720px
  de lado largo, calidad 0.8). Timeout de 30s; si falla devuelve `[]` (la subida
  del video NUNCA se cae por esto).

**2. `lib/llm/scene-check-core.ts` (puro, testeable)**
- `SCENE_CHECK_MODEL` — modelo de visión de Grok (`grok-4.3`, reemplazo oficial del
  modelo fast retirado; soporta imágenes y queda en un solo lugar).
- `buildSceneCheckRequest({ frames, clientContext, apiKey, model })` — request a
  Responses API
  con las imágenes en base64 y el prompt: "Lee TODO el texto visible en pantalla
  en estos frames de un video en español. Reporta SOLO errores de ortografía o
  gramática", más el contexto del cliente y salida JSON Schema estricta.
- `parseSceneCheckResponse(json)` → `SceneCheckReport`.
- `describeFramesPromptFragment()` — segundo uso: pedirle a Grok una descripción
  de 1–2 oraciones del video (tema) cuando la tarjeta no tiene "¿de qué es?".

**Tipo del reporte (jsonb en DB y TS):**
```ts
type SceneCheckReport = {
  status: 'ok' | 'issues' | 'error' | 'skipped'
  checkedAt: string           // ISO
  framesAnalyzed: number
  issues: Array<{
    text: string              // texto tal como aparece en pantalla
    problem: string           // "«exelente» — falta la c: «excelente»"
    approxSecond: number | null
  }>
  videoTopic: string | null   // descripción del contenido (para caption sin tema)
  clientMatch?: {
    status: 'match' | 'mismatch' | 'uncertain'
    reason: string
    evidence: string[]
  }
  error?: string              // cuando status = 'error'
}
```

**3. `lib/actions/scene-check.ts` (server action, nuevo)**
- `analyzeUploadedVideo({ videoId, ideaId, frames: base64[] })`:
  1. `requirePermission('video.upload')` (mismo permiso que subir).
  2. Llama a Grok visión con los frames → `SceneCheckReport`.
  3. Guarda el reporte en `content_idea_videos.scene_check`.
  4. Si la idea no tiene `generated_caption`: llama `generateIdeaCaption(ideaId)`;
     si la idea no tiene tema, pasa `report.videoTopic` como tema efectivo
     (se extiende `generateIdeaCaption` con `opts.topicOverride`).
  5. Registra actividad: `logIdeaActivity('scene_check_completed', …)` y el
     caption automático queda logueado por el flujo existente.
  - Errores de Grok → reporte `status:'error'` guardado; nunca lanza al cliente.

**4. Migración `supabase/migrations/0043_scene_check.sql`**
- `alter table content_idea_videos add column scene_check jsonb;`

**5. UI — tarjeta del video (`editor-video-card.tsx` / panel del pipeline)**
- Sin reporte → nada nuevo.
- `status:'ok'` → badge verde "✓ Subtítulos revisados por AI".
- `status:'issues'` → badge ámbar "⚠ N posibles errores en subtítulos", expandible:
  lista de `problem` + minuto aproximado.
- `status:'error'`/`'skipped'` → texto gris discreto "Revisión AI no disponible"
  con botón "Reintentar" (re-ejecuta `analyzeUploadedVideo` — requiere re-captura,
  así que el botón solo aparece si el archivo local sigue en memoria; si no,
  simplemente no se muestra).
- El flujo de subida muestra "Analizando subtítulos…" mientras corre, pero la
  subida se confirma independiente del análisis.
- El video editado se puede reproducir dentro de la tarjeta con **Ver**.
- El resultado de cliente aparece como **Corresponde al cliente**, **No parece ser
  del cliente** o **Cliente no confirmado**, con razón/evidencia expandible.

### Flujo de datos

1. Editor sube video (flujo actual: presigned PUT a R2 + `registerR2Video`).
2. En paralelo a la subida, el navegador captura los frames del `File` local.
3. Al confirmarse el registro, el cliente llama `analyzeUploadedVideo` con los
   frames en base64 (~10 × ~80KB ≈ 1MB, dentro del límite de server actions).
4. El server action habla con Grok, guarda reporte, dispara caption si falta.
5. `revalidatePath` refresca la tarjeta con badge + caption.

### Manejo de errores

- Captura de frames falla (códec raro, video corrupto) → `frames: []` →
  reporte `skipped`; la subida sigue igual que hoy.
- Grok caído/timeout → reporte `status:'error'` guardado; caption automático se
  intenta igual solo si la idea tiene tema propio (sin tema y sin Grok, se queda
  como hoy: botón manual).
- Caption automático falla → se loguea, no afecta el reporte de escenas ni la subida.
- `XAI_API_KEY` ausente → `skipped` con mensaje de config (mismo patrón de
  `captionConfigError`).

### Testing (regla global: tests para todo, con edge cases)

- `scene-check-core.test.ts` — build del request (frames→base64, prompt),
  parse de respuesta válida, respuesta sin JSON, respuesta vacía, issues vacíos.
- `scene-check.test.ts` (action, con mocks) — guarda reporte; no sobrescribe
  caption existente; usa `videoTopic` cuando la idea no tiene tema; Grok falla →
  reporte error y subida intacta; sin permiso → error.
- `video-frames.test.ts` — puntos de muestreo equidistantes (función pura de
  timestamps), count=1, video de 0s/duración desconocida → [].
- UI (`editor-video-card.test.tsx`) — render de los 4 estados del badge y del
  detalle expandido con los issues.
- Regresión: subir video con análisis fallando NO rompe el flujo actual de subida.

### Fuera de alcance (YAGNI)

- Legibilidad/posición del texto.
- Transcripción de audio / sincronización de subtítulos con el habla.
- Procesamiento server-side con ffmpeg (enfoque B descartado).
- Bloqueo del flujo o notificaciones a la campana.
