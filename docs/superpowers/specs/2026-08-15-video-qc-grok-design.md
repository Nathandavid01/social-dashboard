# Video QC con Grok 4.6 — análisis visual + caption enriquecido

**Fecha:** 2026-08-15 · **Estado:** aprobado por Eric (diseño en chat) · **Versión objetivo:** v3.35

## Objetivo

Cuando el editor sube el video editado (versión final para QC), el sistema:

1. **Analiza el video con Grok 4.6** (visión por frames): lee los captions quemados
   dentro del video y verifica gramática/ortografía/tildes.
2. **Verifica relevancia**: ¿el contenido corresponde al cliente y a la idea?
3. **Genera el caption** con el generador existente, enriquecido con lo que la IA
   vio en el video, siguiendo el estilo aprendido de Eric (aprobados, rechazados,
   `caption_feedback`, brand voice).

El reporte es **advisory**: nunca bloquea la subida ni la aprobación; Eric decide.

## Restricción de la API (verificada 2026-08-15)

La API de xAI **no acepta video como entrada** — solo imágenes (jpg/png, ≤20 MiB).
`grok-4.6` está confirmado como ID válido vía `GET /v1/models`. Por eso el diseño
extrae fotogramas y los envía como imágenes.

## Arquitectura

### 1. Extracción de frames (browser del editor)

- En `idea-video-panel.tsx` y `editor-video-card.tsx`, al subir `kind:'edited'`
  el browser ya tiene el `File` local. Se extraen **~10 frames** equiespaciados
  con `<video>` + canvas, reescalados a máx. 1080px de lado largo, JPEG q≈0.8.
- Módulo puro `lib/utils/video-frames.ts`: cálculo de timestamps equiespaciados,
  dimensiones de reescalado (testeable sin DOM). El wrapper DOM
  (`lib/utils/video-frames-dom.ts` o similar) hace la captura real.
- **Fallo tolerado**: si el browser no decodifica el codec o el canvas falla,
  el video sube normal y el análisis queda `error` ("análisis no disponible").
  La extracción jamás bloquea ni retrasa el registro del video.
- Los frames **no se persisten en R2** (YAGNI): viajan en el POST de análisis
  como base64 y se descartan.

### 2. Persistencia — tabla `content_idea_video_analysis`

Migración `0061_video_analysis.sql`:

```sql
create table content_idea_video_analysis (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references content_idea_videos(id) on delete cascade,
  idea_id uuid not null references content_ideas(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','done','error')),
  findings jsonb,            -- captions quemados + errores + relevancia (JSON del modelo)
  visual_summary text,       -- resumen visual que alimenta el caption
  model text,                -- ej. grok-4.6
  error_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id)          -- un análisis vivo por video: reemplazo = supersede
);
```

- **Supersede**: si el editor reemplaza el video editado, el análisis nuevo
  upsertea sobre `video_id` (sin historial).
- RLS igual al patrón de las demás tablas internas (service role / staff).
- La feature **degrada seguro** hasta aplicar la migración en prod (patrón del
  repo, ver `docs/TODO.md`).

### 3. Análisis con Grok 4.6 — API route

- `POST /api/video-analysis` (con `maxDuration` elevado): recibe
  `{ videoId, frames: base64[] }`, valida sesión + permiso, upsertea la fila
  `pending`, llama a Grok, guarda `done` + findings, y encadena el paso 4.
- `lib/llm/video-analysis-core.ts` (**puro**, patrón `caption-llm-core.ts`):
  - `Env` tipado: `XAI_API_KEY`, `GROK_VISION_MODEL` (default `grok-4.6`).
  - `buildVideoAnalysisRequest(frames, contexto)` — mensaje multimodal
    (imágenes base64 data-URI + prompt).
  - `parseVideoAnalysisResponse(json)` — valida el JSON del modelo con
    fallback tolerante (respuesta malformada → `error`, nunca throw sin captura).
- `lib/llm/video-analysis.ts` (`'server-only'`): única puerta de red
  (`fetch https://api.x.ai/v1/chat/completions`).
- **Contexto en el prompt**: brief/título de la idea, cliente (`brand_voice`,
  `caption_language`, `caption_notes`). Instrucción explícita: el español
  puertorriqueño y el slang deliberado del brand voice **no son errores**;
  solo señalar faltas objetivas (ortografía, tildes, concordancia, typos).
- **Salida JSON estructurada**:

```json
{
  "burned_captions": { "text": "...", "issues": [{ "quote": "...", "problem": "...", "suggestion": "..." }] },
  "relevance": { "verdict": "ok" | "warning", "explanation": "..." },
  "visual_summary": "qué se ve, tono, escenas"
}
```

### 4. Caption enriquecido (auto-draft)

- `buildIdeaCaptionPrompt` gana un bloque **"Análisis visual del video"**
  (`visual_summary` + texto de captions quemados) cuando existe análisis `done`.
- Al terminar el análisis, la misma ruta encadena `generateIdeaCaption(ideaId,
  { auto: true })` — el generador existente ya aporta estilo de Eric,
  transcripción Whisper, ejemplos Metricool y feedback aprendido.
- Respeta la regla vigente: el auto-draft **nunca pisa** un `caption_draft`
  existente (`use-auto-draft-caption`).

### 5. Reporte advisory en la UI

- Componente `components/video-analysis/video-analysis-report.tsx`:
  ✓/⚠ **Captions del video** y ✓/⚠ **Relevancia**, con detalle expandible
  (quotes + sugerencias) y estados `pending` ("Analizando…") / `error`
  ("Análisis no disponible").
- **Solo superficies internas**: pantalla de aprobación interna (Entregas /
  `getEntregaReviewVideos`) y el panel del video en la idea.
- **Prohibido** en superficies públicas de cliente: `/review/<token>` y
  `/aprobacion` no reciben el análisis (ni en payload ni en render) — test
  que lo garantice.

### 6. Red de seguridad

- Si el editor cierra el tab entre el registro del video y el POST de análisis,
  la fila no existe o queda `pending`: el cron existente `video-health` barre
  videos `edited` recientes sin análisis `done`/`error` y los marca `error`
  con nota ("no se pudo analizar") — *sin* reintentar server-side (no hay
  frames sin el archivo local). El botón de re-análisis queda fuera de alcance
  (YAGNI; se añade si duele).

## Flujo end-to-end

1. Editor sube el editado (cualquiera de los **dos** caminos: `registerR2Video`
   kind `edited` o `registerEntregasVideo`).
2. Browser extrae ~10 frames → `POST /api/video-analysis`.
3. Grok 4.6 analiza → fila `done` con findings + `visual_summary`.
4. Se encadena el auto-draft del caption (generador existente + bloque visual).
5. Eric abre aprobación: ve el video, el reporte advisory y el caption draft.

## Testing (TDD)

- **Puros**: timestamps/reescalado de frames; `buildVideoAnalysisRequest` /
  `parseVideoAnalysisResponse` (incluye JSON malformado y campos faltantes);
  bloque visual en `buildIdeaCaptionPrompt` (con y sin análisis).
- **Render**: reporte con findings, `pending`, `error`; ausencia del reporte
  en las vistas públicas.
- **Regresión**: subir video con extracción fallida → video registrado igual;
  auto-draft no pisa draft existente.
- **Edge cases**: video sin idea/cliente asociado; frames vacíos; análisis
  duplicado (reemplazo de video → supersede); respuesta del modelo sin
  `issues`.

## Fuera de alcance

- Audio/desincronía voz-caption (requeriría STT adicional en este paso).
- Historial de análisis; botón de re-análisis manual; análisis de raw/b-roll.
- Bloqueo o rechazo automático (es advisory por decisión de Eric).

## Proceso

TDD · bump `lib/version.ts` a 3.35 + changelog + preview HTML · PR con checks
(`test`, `merge-gate`, relationship-guard) · migración `0061` se aplica en prod
vía SQL Editor (anotar en `docs/TODO.md`).
