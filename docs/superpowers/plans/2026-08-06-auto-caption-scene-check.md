# Auto-caption + Scene Check (Grok visión) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al subir el video editado, Grok visión revisa la ortografía de los subtítulos en pantalla (aviso en la tarjeta, sin bloquear) y se genera el caption automáticamente si falta.

**Architecture:** El navegador captura ~10 frames del `File` local al subirlo (canvas, sin ffmpeg). Un server action nuevo (`analyzeUploadedVideo`) manda los frames a Grok (misma API xAI ya integrada, modelo con visión), guarda un reporte jsonb en `content_idea_videos.scene_check` y dispara `generateIdeaCaption` si la tarjeta no tiene caption (usando lo que Grok vio como tema si falta el hook).

**Tech Stack:** Next.js 14 App Router, server actions, Supabase Postgres, xAI chat-completions (fetch, sin SDK), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-06-auto-caption-scene-check-design.md`

## Global Constraints

- TDD estricto (regla del repo): test primero, luego implementación, luego `npx vitest run <files> --exclude '**/.claude/**'` y `npx tsc --noEmit` antes de dar nada por terminado.
- Trabajar en branch `eric/dev`; commits pequeños en verde; merge a `main` local al final; NO push.
- UI en español; identificadores en inglés.
- RBAC: el action reusa el permiso existente `'video.upload'` (mismo gate que subir video). No se crea slug nuevo.
- Archivos cliente (`'use client'`) NUNCA importan `lib/supabase/server.ts` — los tipos compartidos van en `lib/llm/scene-check-types.ts`.
- La subida de video NUNCA falla por culpa del análisis: todo error de captura/Grok termina en un reporte `status:'error'|'skipped'` o en un log, jamás en throw hacia el flujo de subida.
- El caption automático NUNCA sobrescribe un `generated_caption` existente.
- Migración nueva = archivo nuevo `supabase/migrations/0043_scene_check.sql` (la 0042 ya existe; el spec decía 0042 — corregido aquí). Nunca editar migraciones viejas.

---

### Task 1: Migración + tipos (`scene_check` jsonb)

**Files:**
- Create: `supabase/migrations/0043_scene_check.sql`
- Create: `lib/llm/scene-check-types.ts`
- Modify: `lib/supabase/types.ts` (interface `ContentIdeaVideo`, línea ~72)

**Interfaces:**
- Produces: tipo `SceneCheckReport` y `SceneCheckIssue` (importables desde cliente y servidor); columna `content_idea_videos.scene_check jsonb null`; campo `scene_check: SceneCheckReport | null` en `ContentIdeaVideo`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0043_scene_check.sql
-- Reporte de la revisión AI de subtítulos (Grok visión) por video subido.
-- Shape del jsonb: ver SceneCheckReport en lib/llm/scene-check-types.ts.
alter table content_idea_videos add column if not exists scene_check jsonb;
```

- [ ] **Step 2: Crear los tipos compartidos**

```ts
// lib/llm/scene-check-types.ts
/**
 * Reporte de la revisión AI de subtítulos en pantalla (Grok visión).
 * Vive en content_idea_videos.scene_check (jsonb). Importable desde
 * componentes cliente — NO importar nada server-only aquí.
 */
export interface SceneCheckIssue {
  /** Texto tal como aparece en pantalla. */
  text: string
  /** Explicación del error, en español: «exelente» → falta la c: «excelente». */
  problem: string
  /** Segundo aproximado del video donde aparece (null si no se pudo mapear). */
  approxSecond: number | null
}

export type SceneCheckStatus = 'ok' | 'issues' | 'error' | 'skipped'

export interface SceneCheckReport {
  status: SceneCheckStatus
  checkedAt: string // ISO
  framesAnalyzed: number
  issues: SceneCheckIssue[]
  /** Descripción corta del contenido del video (tema para el caption automático). */
  videoTopic: string | null
  /** Presente cuando status === 'error' | 'skipped'. */
  error?: string
}
```

- [ ] **Step 3: Agregar el campo al Row type**

En `lib/supabase/types.ts`, dentro de `interface ContentIdeaVideo` (después de `error_message: string | null`):

```ts
  scene_check: SceneCheckReport | null
```

con `import type { SceneCheckReport } from '@/lib/llm/scene-check-types'` arriba del archivo.

- [ ] **Step 4: Verificar tipos y selects**

Run: `npx tsc --noEmit`
Expected: sin errores. Los consumidores cargan videos con `select('*')` o columnas explícitas; grep de control: `grep -rn "from('content_idea_videos')" lib | grep -v test` — ninguno necesita cambio porque el campo es opcional-null y solo la UI nueva lo leerá (Task 5 ajusta el select si su fuente usa columnas explícitas).

- [ ] **Step 5: Aplicar la migración al proyecto linkeado**

Run: `npx supabase db push`
Si pide password/falla por credenciales: NO bloquear el resto del plan — dejar TODO en `docs/TODO.md` («aplicar 0043_scene_check.sql») y seguir; el action tolera la columna ausente (error de update → log).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0043_scene_check.sql lib/llm/scene-check-types.ts lib/supabase/types.ts
git commit -m "feat(scene-check): columna scene_check + tipos del reporte"
```

---

### Task 2: Core puro de Grok visión (`scene-check-core`)

**Files:**
- Create: `lib/llm/scene-check-core.ts`
- Test: `lib/llm/scene-check-core.test.ts`

**Interfaces:**
- Consumes: `SceneCheckReport`, `SceneCheckIssue` de `lib/llm/scene-check-types.ts`; patrón de `buildGrokRequest`/`parseGrokResponse` de `caption-llm-core.ts` (referencia de estilo, no se importa).
- Produces:
  - `SCENE_CHECK_MODEL = 'grok-4-1-fast-non-reasoning'` (mismo endpoint `GROK_CHAT_COMPLETIONS_URL`; override por env `GROK_SCENE_CHECK_MODEL`)
  - `sceneCheckModelId(env: { GROK_SCENE_CHECK_MODEL?: string }): string`
  - `buildSceneCheckRequest(input: { frames: Array<{ b64: string; second: number }>; apiKey: string; model: string }): GrokRequest` (mismo shape `{url, headers, body}`)
  - `parseSceneCheckResponse(json: unknown, frames: Array<{ second: number }>): { issues: SceneCheckIssue[]; videoTopic: string | null } | null` (null = respuesta inservible)

- [ ] **Step 1: Escribir tests que fallan**

```ts
// lib/llm/scene-check-core.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildSceneCheckRequest,
  parseSceneCheckResponse,
  sceneCheckModelId,
  SCENE_CHECK_MODEL,
} from './scene-check-core'

const frames = [
  { b64: 'AAAA', second: 2 },
  { b64: 'BBBB', second: 10 },
]

describe('sceneCheckModelId', () => {
  it('usa el default', () => {
    expect(sceneCheckModelId({})).toBe(SCENE_CHECK_MODEL)
  })
  it('respeta el override por env', () => {
    expect(sceneCheckModelId({ GROK_SCENE_CHECK_MODEL: 'grok-x' })).toBe('grok-x')
  })
})

describe('buildSceneCheckRequest', () => {
  it('arma un request OpenAI-compatible con las imágenes en data URLs', () => {
    const req = buildSceneCheckRequest({ frames, apiKey: 'k', model: 'm' })
    expect(req.url).toContain('api.x.ai')
    expect(req.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('m')
    const content = body.messages[0].content
    // 1 bloque de texto + 1 image_url por frame
    expect(content.filter((c: { type: string }) => c.type === 'image_url')).toHaveLength(2)
    expect(content[0].type).toBe('text')
    expect(content[0].text).toMatch(/ortografía/i)
    expect(content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA')
    // pide JSON estricto
    expect(body.response_format?.type).toBe('json_object')
  })
})

describe('parseSceneCheckResponse', () => {
  const wrap = (content: string) => ({ choices: [{ message: { content } }] })

  it('parsea issues y mapea frameIndex → approxSecond', () => {
    const json = wrap(JSON.stringify({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', frameIndex: 1 }],
      videoTopic: 'Promo de uniformes',
    }))
    const out = parseSceneCheckResponse(json, frames)
    expect(out).toEqual({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', approxSecond: 10 }],
      videoTopic: 'Promo de uniformes',
    })
  })

  it('frameIndex fuera de rango o ausente → approxSecond null', () => {
    const json = wrap(JSON.stringify({ issues: [{ text: 'x', problem: 'y', frameIndex: 99 }], videoTopic: null }))
    expect(parseSceneCheckResponse(json, frames)!.issues[0].approxSecond).toBeNull()
  })

  it('sin issues → lista vacía', () => {
    const json = wrap(JSON.stringify({ issues: [], videoTopic: 'algo' }))
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: 'algo' })
  })

  it('content con texto alrededor del JSON (```json ... ```) igual parsea', () => {
    const json = wrap('```json\n{"issues":[],"videoTopic":"t"}\n```')
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: 't' })
  })

  it('respuesta sin JSON válido → null', () => {
    expect(parseSceneCheckResponse(wrap('no hay nada'), frames)).toBeNull()
  })

  it('respuesta vacía / shape inesperado → null', () => {
    expect(parseSceneCheckResponse({}, frames)).toBeNull()
    expect(parseSceneCheckResponse(null, frames)).toBeNull()
  })

  it('issues con campos no-string se descartan', () => {
    const json = wrap(JSON.stringify({ issues: [{ text: 5, problem: null }], videoTopic: null }))
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: null })
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run lib/llm/scene-check-core.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/llm/scene-check-core.ts
/**
 * Core puro (sin red, sin SDK) de la revisión de subtítulos con Grok visión.
 * El HTTP vive en lib/actions/scene-check.ts. Mismo patrón que caption-llm-core.
 */
import { GROK_CHAT_COMPLETIONS_URL, type GrokRequest } from './caption-llm-core'
import type { SceneCheckIssue } from './scene-check-types'

/** Modelo con visión: el default de captions también acepta imágenes. */
export const SCENE_CHECK_MODEL = 'grok-4-1-fast-non-reasoning'

export function sceneCheckModelId(env: { GROK_SCENE_CHECK_MODEL?: string }): string {
  return (env.GROK_SCENE_CHECK_MODEL ?? '').trim() || SCENE_CHECK_MODEL
}

const PROMPT = [
  'Estos frames vienen de un video en español para redes sociales, en orden cronológico.',
  'Lee TODO el texto visible en pantalla (subtítulos, títulos, textos quemados).',
  'Reporta SOLO errores de ortografía o gramática del español (tildes, letras, concordancia).',
  'NO reportes estilo, mayúsculas intencionales, anglicismos de marca ni emojis.',
  'Además describe en una oración de qué trata el video.',
  'Responde SOLO con JSON: {"issues":[{"text":"texto tal cual en pantalla","problem":"explicación corta del error y la corrección","frameIndex":N}],"videoTopic":"descripción de una oración"}',
  'Si no hay texto en pantalla o no hay errores, "issues" va vacío.',
].join('\n')

export function buildSceneCheckRequest(input: {
  frames: Array<{ b64: string; second: number }>
  apiKey: string
  model: string
}): GrokRequest {
  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          ...input.frames.map((f) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${f.b64}` },
          })),
        ],
      }],
    }),
  }
}

/** Saca el primer objeto JSON del content (tolera ```json fences). */
function extractJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

export function parseSceneCheckResponse(
  json: unknown,
  frames: Array<{ second: number }>,
): { issues: SceneCheckIssue[]; videoTopic: string | null } | null {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] })?.choices
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  const parsed = extractJson(content) as {
    issues?: unknown
    videoTopic?: unknown
  } | null
  if (!parsed || !Array.isArray(parsed.issues)) return null

  const issues: SceneCheckIssue[] = parsed.issues.flatMap((raw) => {
    const r = raw as { text?: unknown; problem?: unknown; frameIndex?: unknown }
    if (typeof r.text !== 'string' || typeof r.problem !== 'string') return []
    const idx = typeof r.frameIndex === 'number' ? r.frameIndex : -1
    const second = idx >= 0 && idx < frames.length ? frames[idx].second : null
    return [{ text: r.text, problem: r.problem, approxSecond: second }]
  })
  const videoTopic = typeof parsed.videoTopic === 'string' && parsed.videoTopic.trim()
    ? parsed.videoTopic.trim() : null
  return { issues, videoTopic }
}
```

Nota: `caption-llm-core.ts` debe exportar `GrokRequest` (ya lo hace: `export interface GrokRequest`).

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run lib/llm/scene-check-core.test.ts --exclude '**/.claude/**'` y `npx tsc --noEmit`
Expected: PASS, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/scene-check-core.ts lib/llm/scene-check-core.test.ts
git commit -m "feat(scene-check): core puro del request/parse de Grok visión"
```

---

### Task 3: Captura de frames en el navegador (`video-frames`)

**Files:**
- Create: `lib/utils/video-frames.ts`
- Test: `lib/utils/video-frames.test.ts`

**Interfaces:**
- Produces:
  - `frameTimestamps(durationSec: number, count?: number): number[]` — pura, testeable.
  - `captureVideoFrames(file: File, count?: number): Promise<Array<{ b64: string; second: number }>>` — DOM; devuelve `[]` ante cualquier fallo (nunca lanza). `b64` SIN prefijo `data:`.

- [ ] **Step 1: Tests de la parte pura**

```ts
// lib/utils/video-frames.test.ts
import { describe, it, expect } from 'vitest'
import { frameTimestamps } from './video-frames'

describe('frameTimestamps', () => {
  it('reparte count puntos equidistantes evitando el frame 0 y el último medio segundo', () => {
    const ts = frameTimestamps(60, 10)
    expect(ts).toHaveLength(10)
    expect(ts[0]).toBeGreaterThan(0)
    expect(ts[ts.length - 1]).toBeLessThanOrEqual(59.5)
    // equidistantes (paso constante)
    const step = ts[1] - ts[0]
    for (let i = 2; i < ts.length; i++) {
      expect(ts[i] - ts[i - 1]).toBeCloseTo(step, 5)
    }
  })
  it('count=1 → punto medio', () => {
    expect(frameTimestamps(30, 1)).toEqual([15])
  })
  it('video muy corto → menos frames pero al menos 1 si hay duración', () => {
    const ts = frameTimestamps(1, 10)
    expect(ts.length).toBeGreaterThanOrEqual(1)
    expect(ts.every((t) => t > 0 && t <= 1)).toBe(true)
  })
  it('duración 0, negativa o NaN → []', () => {
    expect(frameTimestamps(0, 10)).toEqual([])
    expect(frameTimestamps(-5, 10)).toEqual([])
    expect(frameTimestamps(Number.NaN, 10)).toEqual([])
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run lib/utils/video-frames.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/utils/video-frames.ts
/**
 * Captura de frames de un video en el NAVEGADOR (canvas — sin ffmpeg).
 * Enfoque A del spec: los frames viajan al server action como base64.
 * Cualquier fallo devuelve [] — la subida del video nunca depende de esto.
 */

export const DEFAULT_FRAME_COUNT = 10
/** Lado largo máximo del JPEG exportado. */
const MAX_DIM = 720
const JPEG_QUALITY = 0.8
const CAPTURE_TIMEOUT_MS = 30_000

/** Puntos de muestreo equidistantes, evitando el frame 0 y el último 0.5s. */
export function frameTimestamps(durationSec: number, count = DEFAULT_FRAME_COUNT): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || count < 1) return []
  const end = Math.max(durationSec - 0.5, durationSec * 0.9)
  const usable = Math.min(end, durationSec)
  const n = Math.min(count, Math.max(1, Math.floor(durationSec)))
  const step = usable / (n + 1)
  return Array.from({ length: n }, (_, i) => (i + 1) * step)
}

export async function captureVideoFrames(
  file: File,
  count = DEFAULT_FRAME_COUNT,
): Promise<Array<{ b64: string; second: number }>> {
  if (typeof document === 'undefined') return []
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  const cleanup = () => {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('frame capture timeout')), CAPTURE_TIMEOUT_MS),
  )

  try {
    return await Promise.race([timeout, (async () => {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('video load error'))
      })
      const timestamps = frameTimestamps(video.duration, count)
      if (!timestamps.length) return []

      const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx || !canvas.width || !canvas.height) return []

      const frames: Array<{ b64: string; second: number }> = []
      for (const second of timestamps) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve()
          video.onerror = () => reject(new Error('seek error'))
          video.currentTime = second
        })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        const b64 = dataUrl.split(',')[1]
        if (b64) frames.push({ b64, second: Math.round(second) })
      }
      return frames
    })()])
  } catch {
    return []
  } finally {
    cleanup()
  }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run lib/utils/video-frames.test.ts --exclude '**/.claude/**'` y `npx tsc --noEmit`
Expected: PASS. (`captureVideoFrames` no se unit-testea en jsdom — no decodifica video; su contrato «[] ante fallo» queda cubierto por el test de regresión de Task 5.)

- [ ] **Step 5: Commit**

```bash
git add lib/utils/video-frames.ts lib/utils/video-frames.test.ts
git commit -m "feat(scene-check): captura de frames del video en el navegador"
```

---

### Task 4: Server action `analyzeUploadedVideo` + topicOverride del caption

**Files:**
- Create: `lib/actions/scene-check.ts`
- Modify: `lib/actions/idea-captions.ts` (función `generateIdeaCaption`, ~línea 20-47)
- Test: `lib/actions/scene-check.test.ts`

**Interfaces:**
- Consumes: `buildSceneCheckRequest`, `parseSceneCheckResponse`, `sceneCheckModelId` (Task 2); tipos de Task 1.
- Produces:
  - `analyzeUploadedVideo(input: { videoId: string; ideaId: string; frames: Array<{ b64: string; second: number }> }): Promise<{ ok?: true; report?: SceneCheckReport; error?: string }>`
  - `generateIdeaCaption(ideaId, opts?: { feedback?: string | null; previousCaption?: string | null; topicOverride?: string | null })` — cuando la idea no tiene `hook` y llega `topicOverride`, se usa ese texto como hook efectivo en vez de fallar con «Di de qué es el video».

- [ ] **Step 1: Extender `generateIdeaCaption` con `topicOverride` (test primero)**

Agregar a `lib/actions/scene-check.test.ts` (los tests del action van todos en este archivo; el de captions ya tiene los suyos — no tocarlos):

```ts
// lib/actions/scene-check.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks de módulo (mismo patrón que idea-videos-r2.test.ts / users.test.ts) ──
const mockRequirePermission = vi.fn()
vi.mock('@/lib/auth/server', () => ({ requirePermission: (...a: unknown[]) => mockRequirePermission(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockGenerateIdeaCaption = vi.fn()
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...a: unknown[]) => mockGenerateIdeaCaption(...a),
}))

const mockLogIdeaActivity = vi.fn()
vi.mock('@/lib/utils/idea-activity', () => ({
  logIdeaActivity: (...a: unknown[]) => mockLogIdeaActivity(...a),
}))

// Supabase chainable mínimo: from().update().eq() y from().select().eq().single()
type Row = Record<string, unknown>
let ideaRow: Row | null
let updateCalls: Array<{ table: string; values: Row }>
function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      return {
        update(values: Row) {
          updateCalls.push({ table, values })
          return { eq: async () => ({ error: null }) }
        },
        select() {
          return { eq: () => ({ single: async () => ({ data: ideaRow, error: null }) }) }
        },
      }
    },
  }
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeSupabase() }))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const frames = [{ b64: 'AAAA', second: 3 }]
const grokJson = (payload: unknown) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
})

beforeEach(() => {
  vi.clearAllMocks()
  updateCalls = []
  ideaRow = { id: 'idea-1', hook: 'promo pizzas', generated_caption: null }
  process.env.XAI_API_KEY = 'test-key'
  mockGenerateIdeaCaption.mockResolvedValue({ ok: true, caption: 'caption!' })
})

describe('analyzeUploadedVideo', () => {
  it('guarda reporte ok cuando no hay issues', async () => {
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: 'pizzas' }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.ok).toBe(true)
    expect(res.report!.status).toBe('ok')
    const saved = updateCalls.find((c) => c.table === 'content_idea_videos')!
    expect((saved.values.scene_check as { status: string }).status).toBe('ok')
  })

  it('guarda reporte issues con los errores encontrados', async () => {
    fetchMock.mockResolvedValue(grokJson({
      issues: [{ text: 'exelente', problem: 'excelente', frameIndex: 0 }],
      videoTopic: null,
    }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.report!.status).toBe('issues')
    expect(res.report!.issues[0]).toEqual({ text: 'exelente', problem: 'excelente', approxSecond: 3 })
  })

  it('frames vacíos → reporte skipped, sin llamar a Grok', async () => {
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames: [] })
    expect(res.report!.status).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin XAI_API_KEY → skipped con mensaje de config', async () => {
    delete process.env.XAI_API_KEY
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.report!.status).toBe('skipped')
    expect(res.report!.error).toMatch(/XAI_API_KEY/)
  })

  it('Grok caído → reporte error guardado, nunca throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.report!.status).toBe('error')
    expect(updateCalls.some((c) => c.table === 'content_idea_videos')).toBe(true)
  })

  it('dispara caption automático solo si la idea NO tiene caption', async () => {
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: 'pizzas' }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).toHaveBeenCalledWith('idea-1', expect.anything())
  })

  it('NO sobrescribe caption existente', async () => {
    ideaRow = { id: 'idea-1', hook: 'promo', generated_caption: 'ya existe' }
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: 'pizzas' }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
  })

  it('idea sin hook → pasa videoTopic como topicOverride', async () => {
    ideaRow = { id: 'idea-1', hook: null, generated_caption: null }
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: 'video de pizzas artesanales' }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).toHaveBeenCalledWith('idea-1', { topicOverride: 'video de pizzas artesanales' })
  })

  it('idea sin hook y Grok sin topic → no intenta caption', async () => {
    ideaRow = { id: 'idea-1', hook: null, generated_caption: null }
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: null }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
  })

  it('caption falla → el reporte igual queda guardado y el action devuelve ok', async () => {
    mockGenerateIdeaCaption.mockResolvedValue({ error: 'llm down' })
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: 'pizzas' }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.ok).toBe(true)
  })

  it('sin permiso → error, sin tocar la DB', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Acceso denegado'))
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.error).toBe('Acceso denegado')
    expect(updateCalls).toHaveLength(0)
  })

  it('registra actividad scene_check_completed', async () => {
    fetchMock.mockResolvedValue(grokJson({ issues: [], videoTopic: null }))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockLogIdeaActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'scene_check_completed',
    }))
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run lib/actions/scene-check.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `./scene-check` no existe.

- [ ] **Step 3: Implementar el action**

```ts
// lib/actions/scene-check.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import {
  buildSceneCheckRequest,
  parseSceneCheckResponse,
  sceneCheckModelId,
} from '@/lib/llm/scene-check-core'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

/**
 * Revisión AI de subtítulos del video recién subido (Grok visión) + caption
 * automático si falta. Espíritu del spec: esto NUNCA rompe la subida — todo
 * fallo termina como reporte 'error'/'skipped' guardado, no como excepción.
 */
export async function analyzeUploadedVideo(input: {
  videoId: string
  ideaId: string
  frames: Array<{ b64: string; second: number }>
}): Promise<{ ok?: true; report?: SceneCheckReport; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const base = { checkedAt: new Date().toISOString(), framesAnalyzed: input.frames.length }
  let report: SceneCheckReport

  const apiKey = (process.env.XAI_API_KEY ?? '').trim()
  if (!input.frames.length) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'No se pudieron capturar frames del video.' }
  } else if (!apiKey) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'XAI_API_KEY no está configurado en el servidor.' }
  } else {
    try {
      const req = buildSceneCheckRequest({
        frames: input.frames,
        apiKey,
        model: sceneCheckModelId(process.env),
      })
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        report = { ...base, status: 'error', issues: [], videoTopic: null, error: `Grok API ${res.status}: ${detail.slice(0, 300)}` }
      } else {
        const parsed = parseSceneCheckResponse(await res.json(), input.frames)
        report = parsed
          ? { ...base, status: parsed.issues.length ? 'issues' : 'ok', issues: parsed.issues, videoTopic: parsed.videoTopic }
          : { ...base, status: 'error', issues: [], videoTopic: null, error: 'La AI no devolvió un reporte legible.' }
      }
    } catch (err) {
      report = { ...base, status: 'error', issues: [], videoTopic: null, error: err instanceof Error ? err.message : 'Error de red' }
    }
  }

  await supabase.from('content_idea_videos').update({ scene_check: report }).eq('id', input.videoId)

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    userId: user?.id ?? null,
    action: 'scene_check_completed',
    metadata: { videoId: input.videoId, status: report.status, issueCount: report.issues.length },
  })

  // ── Caption automático: solo si la idea no tiene caption. ──
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, hook, generated_caption')
    .eq('id', input.ideaId)
    .single()
  if (idea && !idea.generated_caption) {
    const hasTopic = typeof idea.hook === 'string' && idea.hook.trim().length > 0
    if (hasTopic) {
      await generateIdeaCaption(input.ideaId, {}).catch(() => null)
    } else if (report.videoTopic) {
      await generateIdeaCaption(input.ideaId, { topicOverride: report.videoTopic }).catch(() => null)
    }
    // sin hook y sin videoTopic: se queda como hoy (botón manual)
  }

  revalidatePath(`/produccion/idea/${input.ideaId}`)
  revalidatePath('/pipeline')
  return { ok: true, report }
}
```

Ajuste fino para que los tests de «dispara caption» pasen tal cual: con hook presente la llamada es `generateIdeaCaption('idea-1', {})` — cubierta por `expect.anything()`; sin hook es con `{ topicOverride }` exacto.

- [ ] **Step 4: `topicOverride` en `generateIdeaCaption`**

En `lib/actions/idea-captions.ts`:

1. Firma: `opts?: { feedback?: string | null; previousCaption?: string | null; topicOverride?: string | null }`.
2. Sustituir el gate actual:

```ts
  const effectiveHook = filledStr(idea.hook) ? idea.hook : (opts?.topicOverride ?? null)
  if (!effectiveHook || !effectiveHook.trim()) {
    return { error: 'Di de qué es el video para generar el caption.' }
  }
```

(con `const filledStr = (s?: string | null) => !!s && s.trim().length > 0` local, o reusar `isIdeaReadyForCaption` para el caso sin override). Pasar `effectiveHook` donde hoy se pasa `idea.hook` al `buildIdeaCaptionPrompt`.

- [ ] **Step 5: Verificar que todo pasa**

Run: `npx vitest run lib/actions/scene-check.test.ts lib/actions/idea-captions.test.ts lib/llm --exclude '**/.claude/**'` (si `idea-captions.test.ts` no existe, correr los que existan) y `npx tsc --noEmit`
Expected: PASS todos, incluidos los tests previos de captions (regresión).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/scene-check.ts lib/actions/scene-check.test.ts lib/actions/idea-captions.ts
git commit -m "feat(scene-check): action analyzeUploadedVideo + topicOverride del caption"
```

---

### Task 5: UI — badge en la tarjeta + wiring de la subida

**Files:**
- Create: `components/video-pipeline/scene-check-badge.tsx`
- Create: `components/video-pipeline/scene-check-badge.test.tsx`
- Modify: `components/video-pipeline/editor-video-card.tsx` (subida `edited`: ~líneas 130-155; render del video subido)
- Modify (si aplica): el select que alimenta la tarjeta — verificar con `grep -rn "scene_check\|from('content_idea_videos')" lib/actions/video-pipeline.ts lib/actions/video-uploads.ts` que la columna llegue (si el select enumera columnas, añadir `scene_check`).

**Interfaces:**
- Consumes: `SceneCheckReport` (Task 1), `captureVideoFrames` (Task 3), `analyzeUploadedVideo` (Task 4).
- Produces: `<SceneCheckBadge report={SceneCheckReport | null | undefined} />` — client component, sin imports server-only.

- [ ] **Step 1: Tests del badge (fallan primero)**

```tsx
// components/video-pipeline/scene-check-badge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SceneCheckBadge } from './scene-check-badge'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

const base = { checkedAt: '2026-08-06T12:00:00Z', framesAnalyzed: 10, videoTopic: null }

describe('SceneCheckBadge', () => {
  it('sin reporte → no renderiza nada', () => {
    const { container } = render(<SceneCheckBadge report={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('status ok → badge verde de revisado', () => {
    const report: SceneCheckReport = { ...base, status: 'ok', issues: [] }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/subtítulos revisados/i)).toBeInTheDocument()
  })

  it('status issues → badge ámbar con el conteo y detalle expandible', () => {
    const report: SceneCheckReport = {
      ...base,
      status: 'issues',
      issues: [
        { text: 'exelente', problem: '«exelente» → «excelente»', approxSecond: 12 },
        { text: 'aser', problem: '«aser» → «hacer»', approxSecond: null },
      ],
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/2 posibles errores/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2 posibles errores/i }))
    expect(screen.getByText(/«exelente» → «excelente»/)).toBeInTheDocument()
    expect(screen.getByText(/0:12/)).toBeInTheDocument()
    // issue sin segundo: no muestra timestamp
    expect(screen.getByText(/«aser» → «hacer»/)).toBeInTheDocument()
  })

  it('1 solo issue → singular', () => {
    const report: SceneCheckReport = {
      ...base, status: 'issues',
      issues: [{ text: 'x', problem: 'y', approxSecond: null }],
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/1 posible error/i)).toBeInTheDocument()
  })

  it('status error / skipped → nota discreta', () => {
    const report: SceneCheckReport = { ...base, status: 'error', issues: [], error: 'Grok API 500' }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/revisión ai no disponible/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run components/video-pipeline/scene-check-badge.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — componente no existe.

- [ ] **Step 3: Implementar el badge**

```tsx
// components/video-pipeline/scene-check-badge.tsx
'use client'

import { useState } from 'react'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

function fmtSecond(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Badge del resultado de la revisión AI de subtítulos. Solo informa — nunca bloquea. */
export function SceneCheckBadge({ report }: { report: SceneCheckReport | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (!report) return null

  if (report.status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        ✓ Subtítulos revisados por AI
      </span>
    )
  }

  if (report.status === 'issues') {
    const n = report.issues.length
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
        >
          ⚠ {n} {n === 1 ? 'posible error' : 'posibles errores'} en subtítulos
        </button>
        {open && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
            {report.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-amber-500">•</span>
                <span className="min-w-0">
                  {issue.problem}
                  {issue.approxSecond != null && (
                    <span className="ml-1 text-[10px] opacity-70">({fmtSecond(issue.approxSecond)})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // error | skipped — discreto, sin alarmar
  return (
    <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
      Revisión AI no disponible
    </span>
  )
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run components/video-pipeline/scene-check-badge.test.tsx --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Wiring en `editor-video-card.tsx` (test de regresión primero)**

Leer el componente completo antes de tocarlo. En el handler que hoy hace `getR2UploadUrl` → PUT → `registerR2Video` (~líneas 138-149), añadir después del registro exitoso:

```ts
// Análisis AI en background — la subida ya quedó confirmada arriba.
// captureVideoFrames devuelve [] ante cualquier fallo; analyzeUploadedVideo
// nunca lanza. Nada de esto puede tumbar el flujo de subida.
if (res.ok && res.id) {
  setAnalyzing(true)
  try {
    const frames = await captureVideoFrames(file)
    await analyzeUploadedVideo({ videoId: res.id, ideaId, frames })
  } catch {
    // best-effort: el reporte queda como esté; la tarjeta muestra "no disponible"
  } finally {
    setAnalyzing(false)
    router.refresh() // trae scene_check + caption nuevos (usar el patrón de refresh que ya tenga el componente)
  }
}
```

con `const [analyzing, setAnalyzing] = useState(false)` y, junto al estado de subida existente, el texto `{analyzing && <span className="text-xs text-muted-foreground">Analizando subtítulos…</span>}`.

Render del badge: donde la tarjeta lista el video `edited` subido, añadir `<SceneCheckBadge report={video.scene_check} />` (el objeto `video` que ya recibe la tarjeta; si su tipo local no incluye `scene_check`, viene de `ContentIdeaVideo` — Task 1 ya lo tiene). El contenedor del header de la tarjeta debe respetar el patrón `flex-wrap items-center gap-x-3 gap-y-2` + `min-w-0`/`shrink-0` del CLAUDE.md.

**Reintentar (del spec):** guardar el último archivo subido en un ref (`const lastFileRef = useRef<{ file: File; videoId: string } | null>(null)`, seteado tras `registerR2Video` exitoso). Junto al `<SceneCheckBadge>`, cuando `video.scene_check?.status === 'error' || 'skipped'` Y `lastFileRef.current?.videoId === video.id`, mostrar un botón texto `Reintentar` que re-ejecuta el bloque captura+`analyzeUploadedVideo` con ese archivo. Si el ref no coincide (recargaron la página), el botón simplemente no aparece — comportamiento definido en el spec. Cubierto por un test: con reporte `error` y sin ref, no hay botón.

Test de regresión en `editor-video-card.test.tsx` (añadir al describe existente, siguiendo sus mocks actuales):

```tsx
it('la subida se confirma aunque el análisis AI falle', async () => {
  // mock: registerR2Video resuelve ok; analyzeUploadedVideo rechaza
  // (vi.mock de '@/lib/actions/scene-check' → analyzeUploadedVideo: vi.fn().mockRejectedValue(new Error('boom')))
  // mock: captureVideoFrames → [] (vi.mock de '@/lib/utils/video-frames')
  // subir un File simulado y esperar que el nombre del archivo aparezca como subido
  // y que NO se muestre ningún error de subida.
})
```

(Implementarlo con los helpers/mocks reales del archivo — ya mockea `registerR2Video`; añadir los dos mocks nuevos arriba del archivo para que TODOS los tests existentes sigan pasando: `captureVideoFrames` → `[]` y `analyzeUploadedVideo` → `{ ok: true }` por defecto.)

- [ ] **Step 6: Verificar la suite del componente + tipos**

Run: `npx vitest run components/video-pipeline --exclude '**/.claude/**'` y `npx tsc --noEmit`
Expected: PASS — los tests viejos del card intactos (regresión) + el nuevo.

- [ ] **Step 7: Verificar el select de la tarjeta**

Run: `grep -rn "from('content_idea_videos')" lib/actions | grep -v test` y revisar el que alimenta el pipeline/tarjeta (`video-pipeline.ts` / `video-uploads.ts`): si usa columnas explícitas, añadir `scene_check`; si usa `*`, no hay cambio. Confirmar con `npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add components/video-pipeline/scene-check-badge.tsx components/video-pipeline/scene-check-badge.test.tsx components/video-pipeline/editor-video-card.tsx
git commit -m "feat(scene-check): badge de subtítulos + análisis automático al subir video"
```

---

### Task 6: Verificación final + changelog + merge

**Files:**
- Modify: `CHANGELOG.md` (nueva entrada arriba)
- Modify: `package.json` solo si el proyecto versiona ahí (verificar patrón de commits previos: la versión vive en el CHANGELOG).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run --exclude '**/.claude/**'` y `npx tsc --noEmit`
Expected: todo verde. Si algo viejo falla, arreglar la causa raíz — no debilitar tests (regla global).

- [ ] **Step 2: Prueba manual en el preview**

Con el dev server (`preview_start`, ya configurado): subir un video corto a una tarjeta del pipeline con una cuenta con rol → ver "Analizando subtítulos…", luego el badge, y el caption auto-generado si la tarjeta no tenía. Si la sesión local no tiene perfil (problema conocido), verificar al menos que la subida sigue funcionando y que no hay errores en `read_console_messages`/`preview_logs`.

- [ ] **Step 3: Entrada de CHANGELOG**

Siguiendo el formato del archivo (versión siguiente a la última entrada, fecha 2026-08-06, tono de "Novedades" en español para el equipo):

```markdown
## v2.95 — 2026-08-06

- **La AI revisa los subtítulos del video y escribe el caption sola al subirlo.** Al subir el video editado, Grok mira varias escenas y avisa en la tarjeta si hay errores de ortografía en los textos en pantalla ("⚠ 2 posibles errores en subtítulos", con el detalle y el minuto). Es solo un aviso — nunca bloquea la subida ni el flujo. Y si la tarjeta no tenía caption, se genera automáticamente: con el tema que escribió el equipo, o, si no hay, con lo que la AI vio en el video.
```

(Ajustar el número de versión al siguiente disponible según la última entrada del CHANGELOG en ese momento.)

- [ ] **Step 4: Commit + merge a main (local, sin push)**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): v2.95 — scene check AI + caption automático al subir video"
git checkout main && git merge eric/dev --no-edit
```

(Si el trabajo se hizo directo en `main` por decisión del ejecutor, omitir el merge — pero el default del repo es branch `eric/dev`.)
