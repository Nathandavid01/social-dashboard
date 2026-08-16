# Video QC con Grok 4.6 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al subir el editor un video editado, analizarlo con Grok 4.6 (frames extraídos en el browser): gramática de los captions quemados, relevancia con el cliente, y auto-draft del caption enriquecido con lo visto.

**Architecture:** El browser extrae ~8 frames del `File` local y los manda como base64 a `POST /api/video-analysis`; la ruta llama a Grok 4.6 (multimodal, OpenAI-compatible), upsertea la fila en `content_idea_video_analysis` y encadena `generateIdeaCaption(auto:true)`. El reporte advisory se muestra solo en superficies internas.

**Tech Stack:** Next.js 14 App Router · Supabase · fetch a `api.x.ai/v1/chat/completions` (sin SDK nuevo) · vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-15-video-qc-grok-design.md`

## Global Constraints

- TDD estricto: test rojo → implementación → verde. Verificar con `npx vitest run <files> --exclude '**/.claude/**'` y `npx tsc --noEmit` (nunca `next build` con `next dev` corriendo).
- UI en español; identificadores en inglés.
- El análisis **jamás** bloquea ni retrasa una subida: todo fallo degrada a fila `error` o a no-analizado.
- El reporte **nunca** llega a superficies públicas (`/review/<token>`, `/aprobacion`).
- Modelo: `grok-4.6` con override env `GROK_VISION_MODEL`. Patrón `Env` tipado + módulo `-core` puro (como `caption-llm-core.ts`).
- PostgREST: cualquier embed idea↔videos usa `content_idea_videos!content_idea_videos_idea_id_fkey`; **jamás** añadir un segundo FK entre esas tablas. La tabla nueva referencia videos e ideas directamente, no crea FK entre ellas.
- Permisos existentes reutilizados (least privilege, sin slug nuevo): trigger = `video.upload`; lectura del reporte = `revision.read` || `entregas.read` || `planning.read`.
- Commits pequeños en la rama `eric/video-qc-grok`; nunca push directo a `main`; PR con checks al final.
- Presupuesto de payload: ≤8 frames, lado largo ≤960px, JPEG q0.7, total base64 ≤3.5 MB (límite de body en Vercel ~4.5 MB).

---

### Task 1: Migración `0061_video_analysis.sql` + tipos

**Files:**
- Create: `supabase/migrations/0061_video_analysis.sql`
- Modify: `docs/TODO.md` (sección "Migraciones por aplicar en prod")

**Interfaces:**
- Produces: tabla `content_idea_video_analysis` (una fila viva por `video_id`, upsert = supersede). Columnas usadas por Tasks 5–6 y 9: `video_id, idea_id, status('pending'|'done'|'error'), findings jsonb, visual_summary text, model text, error_note text`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0061 — Análisis IA del video editado (Grok 4.6 sobre frames)
--
-- Una fila viva por video (unique video_id): re-subir el editado supersede el
-- análisis anterior vía upsert. Advisory: nunca bloquea aprobación.
-- El servidor escribe con service role; el staff autenticado solo lee.

create table if not exists public.content_idea_video_analysis (
  id              uuid primary key default uuid_generate_v4(),
  video_id        uuid not null references public.content_idea_videos(id) on delete cascade,
  idea_id         uuid not null references public.content_ideas(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'done', 'error')),
  findings        jsonb,
  visual_summary  text,
  model           text,
  error_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (video_id)
);

create index if not exists cva_idea_idx
  on public.content_idea_video_analysis (idea_id, updated_at desc);

comment on table public.content_idea_video_analysis is
  'Reporte advisory de Grok 4.6 sobre el video editado: captions quemados (gramática), relevancia con el cliente y resumen visual.';

alter table public.content_idea_video_analysis enable row level security;

drop policy if exists "cva: staff read" on public.content_idea_video_analysis;

create policy "cva: staff read"
  on public.content_idea_video_analysis
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Anotar en `docs/TODO.md`**

En la sección "## Migraciones por aplicar en prod", añadir:

```markdown
- [ ] **`0061_video_analysis.sql`** — tabla `content_idea_video_analysis` (QC IA del video editado). La feature degrada seguro: sin tabla, el reporte muestra "Análisis no disponible" y el caption se genera como hasta ahora.
```

- [ ] **Step 3: Verificar tipos y commitear**

Run: `npx tsc --noEmit`
Expected: sin errores (la migración no toca TS).

```bash
git add supabase/migrations/0061_video_analysis.sql docs/TODO.md
git commit -m "feat(db): tabla content_idea_video_analysis para QC IA del video editado"
```

---

### Task 2: Matemática pura de frames — `lib/utils/video-frames.ts`

**Files:**
- Create: `lib/utils/video-frames.ts`
- Test: `lib/utils/video-frames.test.ts`

**Interfaces:**
- Produces:
  - `frameTimestamps(durationSeconds: number, count?: number): number[]` — timestamps equiespaciados evitando el frame 0 y el último instante.
  - `scaleDimensions(w: number, h: number, maxSide?: number): { width: number; height: number }` — reescala manteniendo aspecto; nunca agranda.
  - `capFramesToBudget(frames: string[], maxTotalBytes?: number): string[]` — recorta la lista (desde el final, conservando el primero) hasta caber en el presupuesto (`length * 3/4` del base64 ≈ bytes reales).
  - Constantes: `FRAME_COUNT = 8`, `FRAME_MAX_SIDE = 960`, `FRAME_JPEG_QUALITY = 0.7`, `FRAME_BUDGET_BYTES = 3_500_000`.

- [ ] **Step 1: Escribir el test fallando**

```ts
// lib/utils/video-frames.test.ts
import { describe, it, expect } from 'vitest'
import {
  frameTimestamps, scaleDimensions, capFramesToBudget,
  FRAME_COUNT, FRAME_BUDGET_BYTES,
} from './video-frames'

describe('frameTimestamps', () => {
  it('devuelve N timestamps equiespaciados dentro de (0, duration)', () => {
    const ts = frameTimestamps(60, 4)
    expect(ts).toEqual([12, 24, 36, 48])
  })
  it('usa FRAME_COUNT por defecto', () => {
    expect(frameTimestamps(90)).toHaveLength(FRAME_COUNT)
  })
  it('video muy corto: al menos 1 frame en el medio, sin duplicados', () => {
    const ts = frameTimestamps(0.5, 8)
    expect(ts.length).toBeGreaterThanOrEqual(1)
    expect(new Set(ts).size).toBe(ts.length)
    for (const t of ts) { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(0.5) }
  })
  it('duración 0 o negativa: lista vacía', () => {
    expect(frameTimestamps(0)).toEqual([])
    expect(frameTimestamps(-3)).toEqual([])
  })
})

describe('scaleDimensions', () => {
  it('reescala el lado largo a maxSide manteniendo aspecto', () => {
    expect(scaleDimensions(1920, 1080, 960)).toEqual({ width: 960, height: 540 })
    expect(scaleDimensions(1080, 1920, 960)).toEqual({ width: 540, height: 960 })
  })
  it('nunca agranda un video pequeño', () => {
    expect(scaleDimensions(640, 360, 960)).toEqual({ width: 640, height: 360 })
  })
  it('redondea a enteros', () => {
    const { width, height } = scaleDimensions(1013, 771, 960)
    expect(Number.isInteger(width)).toBe(true)
    expect(Number.isInteger(height)).toBe(true)
  })
})

describe('capFramesToBudget', () => {
  const frame = (bytes: number) => 'x'.repeat(Math.ceil((bytes * 4) / 3))
  it('deja pasar frames que caben', () => {
    const frames = [frame(100_000), frame(100_000)]
    expect(capFramesToBudget(frames, 300_000)).toHaveLength(2)
  })
  it('recorta desde el final hasta caber, conservando el primero', () => {
    const frames = [frame(200_000), frame(200_000), frame(200_000)]
    const out = capFramesToBudget(frames, 450_000)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(frames[0])
  })
  it('lista vacía → vacía; usa FRAME_BUDGET_BYTES por defecto', () => {
    expect(capFramesToBudget([])).toEqual([])
    expect(FRAME_BUDGET_BYTES).toBe(3_500_000)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/utils/video-frames.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/utils/video-frames.ts
/**
 * Matemática pura para la extracción de frames del video editado (QC IA).
 * La captura real con <video>+canvas vive en video-frames-dom.ts; aquí solo
 * hay funciones sin DOM para poder testearlas sin mocks.
 */

export const FRAME_COUNT = 8
export const FRAME_MAX_SIDE = 960
export const FRAME_JPEG_QUALITY = 0.7
/** Vercel corta el body ~4.5 MB; margen para JSON + resto del payload. */
export const FRAME_BUDGET_BYTES = 3_500_000

/** N timestamps equiespaciados en (0, duration), sin el frame 0 ni el final. */
export function frameTimestamps(durationSeconds: number, count = FRAME_COUNT): number[] {
  if (!(durationSeconds > 0) || count < 1) return []
  const step = durationSeconds / (count + 1)
  const ts = Array.from({ length: count }, (_, i) => step * (i + 1))
  return [...new Set(ts)].filter((t) => t > 0 && t < durationSeconds)
}

/** Reduce al lado largo maxSide manteniendo aspecto; nunca agranda. */
export function scaleDimensions(
  w: number,
  h: number,
  maxSide = FRAME_MAX_SIDE,
): { width: number; height: number } {
  const largest = Math.max(w, h)
  if (largest <= maxSide) return { width: w, height: h }
  const f = maxSide / largest
  return { width: Math.round(w * f), height: Math.round(h * f) }
}

/**
 * Recorta la lista de data-URIs (desde el final) hasta caber en el presupuesto.
 * El primero siempre se conserva: un solo frame ya permite leer el caption quemado.
 */
export function capFramesToBudget(frames: string[], maxTotalBytes = FRAME_BUDGET_BYTES): string[] {
  const bytes = (s: string) => Math.floor((s.length * 3) / 4)
  const out = [...frames]
  while (out.length > 1 && out.reduce((n, f) => n + bytes(f), 0) > maxTotalBytes) out.pop()
  return out
}
```

- [ ] **Step 4: Verificar verde + tsc**

Run: `npx vitest run lib/utils/video-frames.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS, sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/video-frames.ts lib/utils/video-frames.test.ts
git commit -m "feat(qc-video): matemática pura de extracción de frames"
```

---

### Task 3: Core LLM puro — `lib/llm/video-analysis-core.ts`

**Files:**
- Create: `lib/llm/video-analysis-core.ts`
- Test: `lib/llm/video-analysis-core.test.ts`

**Interfaces:**
- Consumes: nada del resto del plan (independiente).
- Produces:
  - `GROK_VISION_MODEL = 'grok-4.6'` (default), `GROK_CHAT_COMPLETIONS_URL` (reexport del de captions no — constante propia con el mismo valor).
  - `interface VideoAnalysisEnv { XAI_API_KEY?: string; GROK_VISION_MODEL?: string; [key: string]: string | undefined }`
  - `videoAnalysisModelId(env: VideoAnalysisEnv): string`
  - `videoAnalysisConfigError(env: VideoAnalysisEnv): string | null`
  - `interface VideoAnalysisContext { ideaTitle: string; hook?: string | null; clientName?: string | null; brandVoice?: string | null; captionLanguage?: string | null; captionNotes?: string | null }`
  - `buildVideoAnalysisPrompt(ctx: VideoAnalysisContext): string`
  - `buildVideoAnalysisRequest(input: { frames: string[]; prompt: string; apiKey: string; model: string }): { url: string; headers: Record<string, string>; body: string }` — mensaje multimodal OpenAI-compatible.
  - `interface VideoAnalysisIssue { quote: string; problem: string; suggestion: string }`
  - `interface VideoAnalysisFindings { burned_captions: { text: string; issues: VideoAnalysisIssue[] }; relevance: { verdict: 'ok' | 'warning'; explanation: string }; visual_summary: string }`
  - `parseVideoAnalysisResponse(json: unknown): VideoAnalysisFindings | null` — tolera fences ```json, campos faltantes se normalizan; irrecuperable → `null`.

- [ ] **Step 1: Test fallando**

```ts
// lib/llm/video-analysis-core.test.ts
import { describe, it, expect } from 'vitest'
import {
  GROK_VISION_MODEL, videoAnalysisModelId, videoAnalysisConfigError,
  buildVideoAnalysisPrompt, buildVideoAnalysisRequest, parseVideoAnalysisResponse,
} from './video-analysis-core'

describe('videoAnalysisModelId', () => {
  it('default grok-4.6, override por env', () => {
    expect(videoAnalysisModelId({})).toBe('grok-4.6')
    expect(GROK_VISION_MODEL).toBe('grok-4.6')
    expect(videoAnalysisModelId({ GROK_VISION_MODEL: 'grok-4.5' })).toBe('grok-4.5')
    expect(videoAnalysisModelId({ GROK_VISION_MODEL: '  ' })).toBe('grok-4.6')
  })
})

describe('videoAnalysisConfigError', () => {
  it('falta XAI_API_KEY → mensaje; presente → null', () => {
    expect(videoAnalysisConfigError({})).toMatch(/XAI_API_KEY/)
    expect(videoAnalysisConfigError({ XAI_API_KEY: 'k' })).toBeNull()
  })
})

describe('buildVideoAnalysisPrompt', () => {
  it('incluye cliente, idea y la regla de no corregir el español de PR', () => {
    const p = buildVideoAnalysisPrompt({
      ideaTitle: 'Promo agosto', hook: 'Descuentazo', clientName: 'Dental Pro',
      brandVoice: 'cercano, jerga boricua', captionLanguage: 'español', captionNotes: 'nunca usar usted',
    })
    expect(p).toContain('Dental Pro')
    expect(p).toContain('Promo agosto')
    expect(p).toContain('jerga boricua')
    expect(p.toLowerCase()).toContain('puertorriqueño')
    expect(p).toContain('JSON')
  })
  it('sin cliente ni hook no revienta', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'X' })
    expect(p).toContain('X')
  })
})

describe('buildVideoAnalysisRequest', () => {
  it('arma mensaje multimodal con texto + un image_url por frame', () => {
    const req = buildVideoAnalysisRequest({
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      prompt: 'analiza', apiKey: 'k', model: 'grok-4.6',
    })
    expect(req.url).toBe('https://api.x.ai/v1/chat/completions')
    expect(req.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('grok-4.6')
    const content = body.messages[0].content
    expect(content[0]).toEqual({ type: 'text', text: 'analiza' })
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } })
    expect(content).toHaveLength(3)
  })
})

describe('parseVideoAnalysisResponse', () => {
  const wrap = (content: string) => ({ choices: [{ message: { content } }] })
  const good = {
    burned_captions: { text: 'Ven hoy', issues: [{ quote: 'aserca', problem: 'ortografía', suggestion: 'acerca' }] },
    relevance: { verdict: 'ok', explanation: 'habla del cliente' },
    visual_summary: 'doctora hablando a cámara',
  }
  it('parsea JSON limpio', () => {
    expect(parseVideoAnalysisResponse(wrap(JSON.stringify(good)))).toEqual(good)
  })
  it('tolera fences ```json', () => {
    expect(parseVideoAnalysisResponse(wrap('```json\n' + JSON.stringify(good) + '\n```'))).toEqual(good)
  })
  it('normaliza campos faltantes (sin issues, sin verdict)', () => {
    const partial = wrap(JSON.stringify({ visual_summary: 'algo' }))
    const out = parseVideoAnalysisResponse(partial)
    expect(out).toEqual({
      burned_captions: { text: '', issues: [] },
      relevance: { verdict: 'warning', explanation: '' },
      visual_summary: 'algo',
    })
  })
  it('verdict desconocido → warning; respuesta rota → null', () => {
    const weird = wrap(JSON.stringify({ ...good, relevance: { verdict: 'meh', explanation: 'x' } }))
    expect(parseVideoAnalysisResponse(weird)?.relevance.verdict).toBe('warning')
    expect(parseVideoAnalysisResponse(wrap('no es json'))).toBeNull()
    expect(parseVideoAnalysisResponse(null)).toBeNull()
    expect(parseVideoAnalysisResponse({})).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/llm/video-analysis-core.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/llm/video-analysis-core.ts
/**
 * Núcleo puro del QC de video con Grok 4.6 (visión sobre frames).
 * Sin red ni SDK — testeable con objetos planos. La llamada HTTP vive en
 * video-analysis.ts. Patrón calcado de caption-llm-core.ts.
 */

export const GROK_VISION_MODEL = 'grok-4.6'
export const GROK_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions'

export interface VideoAnalysisEnv {
  XAI_API_KEY?: string
  GROK_VISION_MODEL?: string
  [key: string]: string | undefined
}

export function videoAnalysisModelId(env: VideoAnalysisEnv): string {
  return (env.GROK_VISION_MODEL ?? '').trim() || GROK_VISION_MODEL
}

export function videoAnalysisConfigError(env: VideoAnalysisEnv): string | null {
  if (env.XAI_API_KEY && env.XAI_API_KEY.trim().length > 0) return null
  return 'XAI_API_KEY no está configurado en el servidor.'
}

export interface VideoAnalysisContext {
  ideaTitle: string
  hook?: string | null
  clientName?: string | null
  brandVoice?: string | null
  captionLanguage?: string | null
  captionNotes?: string | null
}

export interface VideoAnalysisIssue { quote: string; problem: string; suggestion: string }

export interface VideoAnalysisFindings {
  burned_captions: { text: string; issues: VideoAnalysisIssue[] }
  relevance: { verdict: 'ok' | 'warning'; explanation: string }
  visual_summary: string
}

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

export function buildVideoAnalysisPrompt(ctx: VideoAnalysisContext): string {
  const clientLines = [
    `- Cliente: ${filled(ctx.clientName) ? ctx.clientName : 'desconocido'}`,
    filled(ctx.brandVoice) && `- Voz de marca: ${ctx.brandVoice}`,
    filled(ctx.captionLanguage) && `- Idioma de los captions: ${ctx.captionLanguage}`,
    filled(ctx.captionNotes) && `- Reglas del cliente: ${ctx.captionNotes}`,
  ].filter(Boolean).join('\n')

  const ideaLines = [
    `- Título: ${ctx.ideaTitle}`,
    filled(ctx.hook) && `- Hook: ${ctx.hook}`,
  ].filter(Boolean).join('\n')

  return `Eres el control de calidad de NMedia PR, agencia de marketing puertorriqueña. Te paso fotogramas en orden cronológico de un video editado listo para aprobar.

CLIENTE:
${clientLines}

LA IDEA DEL VIDEO:
${ideaLines}

TAREAS (en este orden):
1. CAPTIONS QUEMADOS: transcribe el texto que aparece EN PANTALLA dentro del video (subtítulos/captions integrados). Señala SOLO faltas objetivas: ortografía, tildes, concordancia, typos, palabras cortadas. IMPORTANTE: el español puertorriqueño, los anglicismos y el slang deliberado de la voz de marca NO son errores — no los "corrijas".
2. RELEVANCIA: ¿el contenido del video corresponde a este cliente y a esta idea? "ok" si claramente sí; "warning" si no se ve relación o parece de otro cliente, explicando por qué.
3. RESUMEN VISUAL: describe en 2-4 frases qué se ve (escenas, personas, acciones, tono, texto destacado) para que un copywriter escriba el caption sin ver el video.

Devuelve SOLO este JSON, sin explicaciones fuera de él:
{
  "burned_captions": { "text": "...", "issues": [{ "quote": "...", "problem": "...", "suggestion": "..." }] },
  "relevance": { "verdict": "ok" | "warning", "explanation": "..." },
  "visual_summary": "..."
}`
}

export function buildVideoAnalysisRequest(input: {
  frames: string[]
  prompt: string
  apiKey: string
  model: string
}): { url: string; headers: Record<string, string>; body: string } {
  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: input.prompt },
          ...input.frames.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      }],
    }),
  }
}

/** Quita fences ```json ... ``` si el modelo los añadió. */
function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export function parseVideoAnalysisResponse(json: unknown): VideoAnalysisFindings | null {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] })?.choices
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw: unknown
  try { raw = JSON.parse(stripFences(content)) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!('visual_summary' in r) && !('burned_captions' in r) && !('relevance' in r)) return null

  const bc = (r.burned_captions ?? {}) as { text?: unknown; issues?: unknown }
  const issues = Array.isArray(bc.issues)
    ? bc.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          quote: typeof i.quote === 'string' ? i.quote : '',
          problem: typeof i.problem === 'string' ? i.problem : '',
          suggestion: typeof i.suggestion === 'string' ? i.suggestion : '',
        }))
    : []
  const rel = (r.relevance ?? {}) as { verdict?: unknown; explanation?: unknown }

  return {
    burned_captions: { text: typeof bc.text === 'string' ? bc.text : '', issues },
    relevance: {
      verdict: rel.verdict === 'ok' ? 'ok' : 'warning',
      explanation: typeof rel.explanation === 'string' ? rel.explanation : '',
    },
    visual_summary: typeof r.visual_summary === 'string' ? r.visual_summary : '',
  }
}
```

- [ ] **Step 4: Verificar verde + tsc**

Run: `npx vitest run lib/llm/video-analysis-core.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/video-analysis-core.ts lib/llm/video-analysis-core.test.ts
git commit -m "feat(qc-video): core puro de análisis con Grok 4.6 (prompt, request multimodal, parseo)"
```

---

### Task 4: Captura DOM + cliente de análisis (fire-and-forget)

**Files:**
- Create: `lib/utils/video-frames-dom.ts`
- Create: `lib/utils/video-analysis-client.ts`
- Test: `lib/utils/video-analysis-client.test.ts`

**Interfaces:**
- Consumes: Task 2 (`frameTimestamps`, `scaleDimensions`, `capFramesToBudget`, constantes).
- Produces:
  - `extractVideoFrames(file: File): Promise<string[]>` (DOM; lanza si el browser no decodifica).
  - `analyzeUploadedVideo(videoId: string, file: File, deps?: { extract?: (f: File) => Promise<string[]>; post?: typeof fetch }): Promise<void>` — **nunca lanza**; con frames vacíos no postea. Es lo único que llaman los uploaders (Task 7).

- [ ] **Step 1: Test fallando (solo el orquestador; la captura DOM no se puede decodificar en jsdom)**

```ts
// lib/utils/video-analysis-client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { analyzeUploadedVideo } from './video-analysis-client'

const file = new File(['x'], 'v.mp4', { type: 'video/mp4' })

describe('analyzeUploadedVideo', () => {
  it('extrae frames y postea a /api/video-analysis con videoId', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true })
    const extract = vi.fn().mockResolvedValue(['data:image/jpeg;base64,AAA'])
    await analyzeUploadedVideo('vid-1', file, { extract, post })
    expect(post).toHaveBeenCalledWith('/api/video-analysis', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ videoId: 'vid-1', frames: ['data:image/jpeg;base64,AAA'] })
  })

  it('la extracción falla → no postea y NO lanza (la subida jamás se rompe)', async () => {
    const post = vi.fn()
    const extract = vi.fn().mockRejectedValue(new Error('codec'))
    await expect(analyzeUploadedVideo('vid-1', file, { extract, post })).resolves.toBeUndefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('0 frames → no postea; el POST falla → no lanza', async () => {
    const post = vi.fn().mockRejectedValue(new Error('red'))
    await analyzeUploadedVideo('vid-1', file, { extract: vi.fn().mockResolvedValue([]), post })
    expect(post).not.toHaveBeenCalled()
    await expect(
      analyzeUploadedVideo('vid-1', file, { extract: vi.fn().mockResolvedValue(['data:image/jpeg;base64,A']), post }),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/utils/video-analysis-client.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar ambos módulos**

```ts
// lib/utils/video-frames-dom.ts
'use client'

/**
 * Captura real de frames con <video> + canvas, en el browser del editor
 * (el File local ya está en memoria — no se descarga nada de R2).
 * Lanza si el codec no decodifica; el caller lo trata como "sin análisis".
 */
import {
  frameTimestamps, scaleDimensions, capFramesToBudget, FRAME_JPEG_QUALITY,
} from './video-frames'

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeek = () => { cleanup(); resolve() }
    const onErr = () => { cleanup(); reject(new Error('seek falló')) }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeek)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener('seeked', onSeek)
    video.addEventListener('error', onErr)
    video.currentTime = t
  })
}

export async function extractVideoFrames(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('el browser no pudo decodificar el video'))
      video.src = url
    })
    const { width, height } = scaleDimensions(video.videoWidth, video.videoHeight)
    if (!width || !height) throw new Error('video sin dimensiones')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas no disponible')

    const frames: string[] = []
    for (const t of frameTimestamps(video.duration)) {
      await seekTo(video, t)
      ctx.drawImage(video, 0, 0, width, height)
      frames.push(canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY))
    }
    return capFramesToBudget(frames)
  } finally {
    URL.revokeObjectURL(url)
    video.src = ''
  }
}
```

```ts
// lib/utils/video-analysis-client.ts
'use client'

/**
 * Dispara el QC IA tras registrar un video editado. Fire-and-forget: NUNCA
 * lanza ni bloquea — si algo falla, simplemente no habrá análisis y el reporte
 * dirá "Análisis no disponible".
 */
import { extractVideoFrames } from './video-frames-dom'

export async function analyzeUploadedVideo(
  videoId: string,
  file: File,
  deps?: { extract?: (f: File) => Promise<string[]>; post?: typeof fetch },
): Promise<void> {
  const extract = deps?.extract ?? extractVideoFrames
  const post = deps?.post ?? fetch
  try {
    const frames = await extract(file)
    if (frames.length === 0) return
    await post('/api/video-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, frames }),
    })
  } catch {
    // Silencioso a propósito: el análisis es advisory, la subida ya terminó.
  }
}
```

- [ ] **Step 4: Verificar verde + tsc**

Run: `npx vitest run lib/utils/video-analysis-client.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/video-frames-dom.ts lib/utils/video-analysis-client.ts lib/utils/video-analysis-client.test.ts
git commit -m "feat(qc-video): extracción de frames en el browser + trigger fire-and-forget"
```

---

### Task 5: Red + ruta `POST /api/video-analysis` (analiza, guarda, encadena caption)

**Files:**
- Create: `lib/llm/video-analysis.ts`
- Create: `app/api/video-analysis/route.ts`
- Test: `lib/llm/video-analysis.test.ts`

**Interfaces:**
- Consumes: Task 3 (todo el core), Task 1 (tabla), `generateIdeaCaption` de `lib/actions/idea-captions.ts` (existente).
- Produces: `analyzeVideoFrames(frames: string[], ctx: VideoAnalysisContext): Promise<VideoAnalysisFindings>` (lanza en fallo de red/parseo) — usada solo por la ruta.

- [ ] **Step 1: Test fallando del wrapper de red (mock de fetch)**

```ts
// lib/llm/video-analysis.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeVideoFrames } from './video-analysis'

const good = {
  burned_captions: { text: 'Ven hoy', issues: [] },
  relevance: { verdict: 'ok', explanation: 'coincide' },
  visual_summary: 'persona a cámara',
}
const okResponse = {
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(good) } }] }),
}

describe('analyzeVideoFrames', () => {
  beforeEach(() => { process.env.XAI_API_KEY = 'test-key' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.XAI_API_KEY })

  it('llama a Grok y devuelve findings parseados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse as Response)
    const out = await analyzeVideoFrames(['data:image/jpeg;base64,A'], { ideaTitle: 'T' })
    expect(out).toEqual(good)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.x.ai/v1/chat/completions')
    expect(JSON.parse((init as RequestInit).body as string).model).toBe('grok-4.6')
  })

  it('sin XAI_API_KEY → lanza con mensaje claro', async () => {
    delete process.env.XAI_API_KEY
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/XAI_API_KEY/)
  })

  it('HTTP no-ok → lanza con status; respuesta imparseable → lanza', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429, text: async () => 'rate' } as Response)
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/429/)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'no json' } }] }) } as Response)
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/no devolvió/)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/llm/video-analysis.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar wrapper + ruta**

```ts
// lib/llm/video-analysis.ts
import 'server-only'
import {
  buildVideoAnalysisPrompt, buildVideoAnalysisRequest, parseVideoAnalysisResponse,
  videoAnalysisModelId, videoAnalysisConfigError,
  type VideoAnalysisContext, type VideoAnalysisFindings, type VideoAnalysisEnv,
} from './video-analysis-core'

export { videoAnalysisModelId, videoAnalysisConfigError } from './video-analysis-core'
export type { VideoAnalysisContext, VideoAnalysisFindings } from './video-analysis-core'

/** Única puerta de red del QC de video. Lanza en config/red/parseo. */
export async function analyzeVideoFrames(
  frames: string[],
  ctx: VideoAnalysisContext,
): Promise<VideoAnalysisFindings> {
  const env = process.env as VideoAnalysisEnv
  const configError = videoAnalysisConfigError(env)
  if (configError) throw new Error(configError)

  const req = buildVideoAnalysisRequest({
    frames,
    prompt: buildVideoAnalysisPrompt(ctx),
    apiKey: env.XAI_API_KEY!,
    model: videoAnalysisModelId(env),
  })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  const findings = parseVideoAnalysisResponse(json)
  if (!findings) throw new Error('La IA no devolvió un análisis válido')
  return findings
}
```

```ts
// app/api/video-analysis/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { analyzeVideoFrames, videoAnalysisModelId } from '@/lib/llm/video-analysis'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'

/** El análisis con ~8 imágenes tarda; sin esto Vercel corta a los 10-15s. */
export const maxDuration = 300

const MAX_FRAMES = 12

/**
 * QC IA del video editado. Lo dispara el browser del editor tras registrar la
 * subida (fire-and-forget). Upsert por video_id: re-subir supersede el análisis.
 * Advisory: aquí ningún error es fatal para el pipeline — queda una fila 'error'.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('video.upload')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { videoId?: unknown; frames?: unknown } | null
  const videoId = typeof body?.videoId === 'string' ? body.videoId : null
  const frames = Array.isArray(body?.frames)
    ? (body!.frames as unknown[]).filter(
        (f): f is string => typeof f === 'string' && f.startsWith('data:image/jpeg;base64,'),
      ).slice(0, MAX_FRAMES)
    : []
  if (!videoId || frames.length === 0) {
    return NextResponse.json({ error: 'videoId y frames son requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, idea_id, kind, idea:content_ideas(id, title, hook, client:clients(name, brand_voice, caption_language, caption_notes))')
    .eq('id', videoId)
    .single()
  if (!video || video.kind !== 'edited') {
    return NextResponse.json({ error: 'Video editado no encontrado' }, { status: 404 })
  }

  const upsert = (row: Record<string, unknown>) =>
    supabase.from('content_idea_video_analysis').upsert(
      { video_id: video.id, idea_id: video.idea_id, updated_at: new Date().toISOString(), ...row },
      { onConflict: 'video_id' },
    )

  await upsert({ status: 'pending', findings: null, visual_summary: null, error_note: null })

  const idea = video.idea as {
    title?: string | null; hook?: string | null
    client?: { name?: string | null; brand_voice?: string | null; caption_language?: string | null; caption_notes?: string | null } | null
  } | null
  try {
    const findings = await analyzeVideoFrames(frames, {
      ideaTitle: idea?.title?.trim() || 'Sin título',
      hook: idea?.hook,
      clientName: idea?.client?.name,
      brandVoice: idea?.client?.brand_voice,
      captionLanguage: idea?.client?.caption_language,
      captionNotes: idea?.client?.caption_notes,
    })
    const { error } = await upsert({
      status: 'done',
      findings,
      visual_summary: findings.visual_summary,
      model: videoAnalysisModelId(process.env),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Encadena el auto-draft del caption con el análisis ya persistido
    // (generateIdeaCaption lo lee de la tabla). Best-effort: sus errores
    // ("falta hook", draft ya existente) no son errores del análisis.
    await generateIdeaCaption(video.idea_id, { auto: true }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    await upsert({ status: 'error', error_note: err instanceof Error ? err.message : 'Error desconocido' })
    return NextResponse.json({ error: 'El análisis falló' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Verificar verde + tsc**

Run: `npx vitest run lib/llm/video-analysis.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/video-analysis.ts lib/llm/video-analysis.test.ts app/api/video-analysis/route.ts
git commit -m "feat(qc-video): ruta de análisis con Grok 4.6 + upsert + encadena auto-draft"
```

---

### Task 6: Bloque visual en el caption + wiring en `generateIdeaCaption`

**Files:**
- Modify: `lib/utils/idea-caption-prompt.ts` (añadir input + bloque)
- Modify: `lib/actions/idea-captions.ts` (leer el análisis y pasarlo)
- Test: `lib/utils/idea-caption-prompt.test.ts` (añadir describe)

**Interfaces:**
- Consumes: Task 1 (tabla), tipos de Task 3 (`VideoAnalysisFindings` solo como forma del jsonb).
- Produces: `IdeaCaptionPromptInput.videoAnalysis?: { visualSummary?: string | null; burnedCaptionsText?: string | null }`.

- [ ] **Step 1: Test fallando (añadir al final de `lib/utils/idea-caption-prompt.test.ts`)**

```ts
describe('bloque de análisis visual (QC IA)', () => {
  const base = { title: 'Promo', examples: [] as { text: string; provider: string }[] }

  it('incluye resumen visual y captions quemados cuando hay análisis', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      videoAnalysis: { visualSummary: 'doctora muestra el consultorio', burnedCaptionsText: 'Agenda tu cita hoy' },
    })
    expect(p).toContain('LO QUE SE VE EN EL VIDEO')
    expect(p).toContain('doctora muestra el consultorio')
    expect(p).toContain('Agenda tu cita hoy')
  })

  it('sin análisis (o vacío) el prompt no cambia', () => {
    const sin = buildIdeaCaptionPrompt({ ...base })
    const vacio = buildIdeaCaptionPrompt({ ...base, videoAnalysis: { visualSummary: '  ', burnedCaptionsText: null } })
    expect(sin).toBe(vacio)
    expect(sin).not.toContain('LO QUE SE VE EN EL VIDEO')
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/utils/idea-caption-prompt.test.ts --exclude '**/.claude/**'`
Expected: FAIL — la propiedad no existe (error de TS) / el bloque no aparece.

- [ ] **Step 3: Implementar en `idea-caption-prompt.ts`**

Añadir al interface `IdeaCaptionPromptInput` (después de `videoTranscript`):

```ts
  /** QC IA (Grok 4.6 sobre frames): qué se VE en el video + texto quemado en pantalla. */
  videoAnalysis?: { visualSummary?: string | null; burnedCaptionsText?: string | null } | null
```

En `buildIdeaCaptionPrompt`, después del bloque `heard` (línea ~150), añadir:

```ts
  const va = input.videoAnalysis
  const seenParts = [
    filled(va?.visualSummary) && `Resumen visual: ${va!.visualSummary!.trim()}`,
    filled(va?.burnedCaptionsText) && `Texto que aparece EN PANTALLA dentro del video: ${va!.burnedCaptionsText!.trim()}`,
  ].filter(Boolean)
  const seen = seenParts.length > 0
    ? `LO QUE SE VE EN EL VIDEO (análisis visual de IA — úsalo para que el caption hable de lo que realmente se muestra):\n${seenParts.join('\n')}\n\n`
    : ''
  const seenBullet = seen
    ? '- El caption refleja lo que se VE en el video (análisis visual), no solo el brief\n'
    : ''
```

Y en el template final: insertar `${seen}` justo después de `${heard}` (línea del return con `${constraints ...}${heard}${approvedBlock}...`) y `${seenBullet}` justo después de `${heardBullet}`.

- [ ] **Step 4: Wiring en `lib/actions/idea-captions.ts`**

En `generateIdeaCaption`, tras el fetch de `vids` (después de calcular `source`, ~línea 69), añadir la lectura del análisis (best-effort):

```ts
  // QC IA: el análisis visual más reciente de un video editado de esta idea.
  // Best-effort — sin tabla (migración pendiente) o sin fila, el caption sale igual.
  const { data: analysis } = await supabase
    .from('content_idea_video_analysis')
    .select('findings, visual_summary, status')
    .eq('idea_id', ideaId)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }))
```

Y en `sharedPrompt`, después de `videoTranscript`:

```ts
    videoAnalysis: analysis
      ? {
          visualSummary: analysis.visual_summary,
          burnedCaptionsText:
            (analysis.findings as { burned_captions?: { text?: string } } | null)?.burned_captions?.text ?? null,
        }
      : null,
```

- [ ] **Step 5: Verificar verde + tsc + suite de captions existente**

Run: `npx vitest run lib/utils/idea-caption-prompt.test.ts lib/llm/caption-llm-core.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS (regresión incluida).

- [ ] **Step 6: Commit**

```bash
git add lib/utils/idea-caption-prompt.ts lib/utils/idea-caption-prompt.test.ts lib/actions/idea-captions.ts
git commit -m "feat(qc-video): el caption se genera con el análisis visual del video"
```

---

### Task 7: Reporte advisory — acción de lectura + componente + superficies internas

**Files:**
- Create: `lib/actions/video-analysis.ts`
- Create: `components/video-analysis/video-analysis-report.tsx`
- Test: `components/video-analysis/video-analysis-report.test.tsx`
- Modify: `components/entregas/review-overlay.tsx` (render del reporte)
- Modify: `components/recording/idea-video-panel.tsx` (render bajo el slot `edited`)
- Test (regresión pública): `lib/actions/review-public-no-analysis.test.ts`

**Interfaces:**
- Consumes: Task 1 (tabla), tipos `VideoAnalysisFindings` de Task 3.
- Produces:
  - `getVideoAnalysis(ideaId: string): Promise<{ analysis?: { status: 'pending' | 'done' | 'error'; findings: VideoAnalysisFindings | null } | null; error?: string }>` — la fila más reciente de la idea; `analysis: null` si no hay (o la tabla no existe aún).
  - `<VideoAnalysisReport ideaId={string} />` — client component autocontenido (fetch vía la acción en `useEffect`).

- [ ] **Step 1: Tests fallando del componente (render de los 4 estados)**

```tsx
// components/video-analysis/video-analysis-report.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VideoAnalysisReport } from './video-analysis-report'
import * as actions from '@/lib/actions/video-analysis'

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

const findings = {
  burned_captions: { text: 'Ven hoy a nuestra clinica', issues: [{ quote: 'clinica', problem: 'falta la tilde', suggestion: 'clínica' }] },
  relevance: { verdict: 'warning' as const, explanation: 'no se menciona al cliente' },
  visual_summary: 'persona hablando a cámara',
}

describe('VideoAnalysisReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('done con issues: muestra ⚠ en captions, ⚠ en relevancia y el detalle', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings } })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Captions del video/)).toBeInTheDocument())
    expect(screen.getAllByText(/⚠|Revisar/).length).toBeGreaterThan(0)
    expect(screen.getByText(/clínica/)).toBeInTheDocument()
    expect(screen.getByText(/no se menciona al cliente/)).toBeInTheDocument()
  })

  it('done sin issues y relevancia ok: muestra ambos checks en verde', async () => {
    mockGet.mockResolvedValue({
      analysis: {
        status: 'done',
        findings: { ...findings, burned_captions: { text: 'Bien escrito', issues: [] }, relevance: { verdict: 'ok', explanation: 'coincide' } },
      },
    })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Sin errores/)).toBeInTheDocument())
    expect(screen.getByText(/Relevante para el cliente/)).toBeInTheDocument()
  })

  it('pending muestra "Analizando…"; error muestra "Análisis no disponible"', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null } })
    const { unmount } = render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Analizando/)).toBeInTheDocument())
    unmount()
    mockGet.mockResolvedValue({ analysis: { status: 'error', findings: null } })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Análisis no disponible/)).toBeInTheDocument())
  })

  it('sin análisis: no renderiza nada', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run components/video-analysis/video-analysis-report.test.tsx --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar acción + componente**

```ts
// lib/actions/video-analysis.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

export interface VideoAnalysisView {
  status: 'pending' | 'done' | 'error'
  findings: VideoAnalysisFindings | null
}

/**
 * El análisis IA más reciente de la idea. SOLO superficies internas — los
 * links públicos de cliente jamás llaman esto. `analysis: null` = no hay
 * (incluye tabla sin migrar: degrada seguro).
 */
export async function getVideoAnalysis(
  ideaId: string,
): Promise<{ analysis?: VideoAnalysisView | null; error?: string }> {
  const allowed =
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read')) ||
    (await currentUserHas('planning.read'))
  if (!allowed) return { error: 'No autorizado' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_video_analysis')
    .select('status, findings')
    .eq('idea_id', ideaId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { analysis: null } // tabla sin migrar u otro fallo: degrada
  if (!data) return { analysis: null }
  return {
    analysis: {
      status: data.status as VideoAnalysisView['status'],
      findings: (data.findings as VideoAnalysisFindings | null) ?? null,
    },
  }
}
```

```tsx
// components/video-analysis/video-analysis-report.tsx
'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, EyeOff, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVideoAnalysis, type VideoAnalysisView } from '@/lib/actions/video-analysis'

/**
 * Reporte ADVISORY del QC IA (Grok 4.6). Solo superficies internas — nunca
 * montarlo en /review/<token> ni /aprobacion (links públicos de cliente).
 */
export function VideoAnalysisReport({ ideaId }: { ideaId: string }) {
  const [analysis, setAnalysis] = useState<VideoAnalysisView | null | undefined>(undefined)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    getVideoAnalysis(ideaId).then((res) => { if (alive) setAnalysis(res.analysis ?? null) })
    return () => { alive = false }
  }, [ideaId])

  if (analysis === undefined || analysis === null) return null

  if (analysis.status === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analizando video con IA…
      </div>
    )
  }
  if (analysis.status === 'error' || !analysis.findings) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <EyeOff className="h-3.5 w-3.5" /> Análisis no disponible
      </div>
    )
  }

  const f = analysis.findings
  const captionsOk = f.burned_captions.issues.length === 0
  const relevanceOk = f.relevance.verdict === 'ok'

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
        {ok
          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 whitespace-nowrap text-[10px]', ok ? 'text-emerald-600' : 'text-amber-600')}>
        {detail}
      </span>
    </div>
  )

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">QC con IA (advisory)</p>
      <Row ok={captionsOk} label="Captions del video" detail={captionsOk ? 'Sin errores' : `${f.burned_captions.issues.length} a revisar`} />
      <Row ok={relevanceOk} label="Relevancia" detail={relevanceOk ? 'Relevante para el cliente' : 'Revisar'} />
      {(!captionsOk || !relevanceOk || f.visual_summary) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} /> Detalles
        </button>
      )}
      {open && (
        <div className="space-y-2 text-xs">
          {f.burned_captions.issues.map((i, n) => (
            <p key={n} className="rounded-md bg-amber-500/10 px-2 py-1.5">
              «{i.quote}» — {i.problem}. Sugerencia: <span className="font-medium">{i.suggestion}</span>
            </p>
          ))}
          {!relevanceOk && <p className="rounded-md bg-amber-500/10 px-2 py-1.5">{f.relevance.explanation}</p>}
          {f.visual_summary && <p className="text-muted-foreground">{f.visual_summary}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Montar en las dos superficies internas**

En `components/entregas/review-overlay.tsx`: importar `VideoAnalysisReport` y renderizar `<VideoAnalysisReport ideaId={ideaId} />` dentro del overlay, encima del `<ReviewQueue …>` (mismo contenedor).

En `components/recording/idea-video-panel.tsx`: importar `VideoAnalysisReport` y, SOLO en el slot `kind === 'edited'`, renderizar `<VideoAnalysisReport ideaId={ideaId} />` debajo de la lista de archivos de ese slot.

- [ ] **Step 5: Test de regresión — las superficies públicas no exponen el análisis**

```ts
// lib/actions/review-public-no-analysis.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El QC IA es interno. Si alguien conecta la tabla de análisis a los flujos
 * públicos de cliente (/review/<token>, /aprobacion), este test lo delata.
 */
describe('el análisis IA no llega a superficies públicas', () => {
  const publicFiles = [
    'lib/actions/review-public.ts',
    'lib/actions/entregas-client-review.ts',
    'app/(review)',
  ]
  it('ningún archivo público referencia content_idea_video_analysis ni getVideoAnalysis', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    for (const target of publicFiles) {
      const out = (() => {
        try {
          return execSync(
            `grep -rn "content_idea_video_analysis\\|getVideoAnalysis\\|VideoAnalysisReport" ${join(process.cwd(), target)}`,
            { encoding: 'utf8' },
          )
        } catch { return '' } // grep sale 1 si no hay matches — es lo que queremos
      })()
      expect(out, `${target} referencia el análisis IA (es interno)`).toBe('')
    }
  })
})
```

- [ ] **Step 6: Verificar verde + tsc**

Run: `npx vitest run components/video-analysis/video-analysis-report.test.tsx lib/actions/review-public-no-analysis.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/video-analysis.ts components/video-analysis/ components/entregas/review-overlay.tsx components/recording/idea-video-panel.tsx lib/actions/review-public-no-analysis.test.ts
git commit -m "feat(qc-video): reporte advisory en aprobación interna y panel de la idea"
```

---

### Task 8: Disparar el análisis desde los TRES uploaders de editado

**Files:**
- Modify: `components/video-pipeline/editor-video-card.tsx:151-153` (tras `registerR2Video`)
- Modify: `components/recording/idea-video-panel.tsx:228-232` (tras `registerR2Video`, solo `kind === 'edited'`)
- Modify: `components/pipeline/use-submit-videos.ts:67-68` (tras `registerEntregasVideo`)
- Test: `components/recording/idea-video-panel.test.tsx` (añadir caso)

**Interfaces:**
- Consumes: Task 4 (`analyzeUploadedVideo`), `registerR2Video`/`registerEntregasVideo` devuelven `{ id }`.

- [ ] **Step 1: Test fallando (en `idea-video-panel.test.tsx`, siguiendo los mocks ya existentes del archivo)**

Añadir un caso: mockear `@/lib/utils/video-analysis-client` con `vi.mock('@/lib/utils/video-analysis-client', () => ({ analyzeUploadedVideo: vi.fn().mockResolvedValue(undefined) }))`, subir un archivo en el slot `edited` (el patrón de subida ya está testeado en ese archivo — reutilizar su setup de `getR2UploadUrl`/`registerR2Video` mockeados con `registerR2Video` devolviendo `{ ok: true, id: 'vid-9' }`) y afirmar:

```ts
expect(vi.mocked(analyzeUploadedVideo)).toHaveBeenCalledWith('vid-9', expect.any(File))
```

Y un segundo caso: subir en el slot `raw` y afirmar `analyzeUploadedVideo` **no** fue llamado.

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run components/recording/idea-video-panel.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — el panel no llama a `analyzeUploadedVideo`.

- [ ] **Step 3: Implementar los tres hooks (idéntico patrón, fire-and-forget con `void`)**

`components/recording/idea-video-panel.tsx` — en `uploadOne`, tras el register:

```ts
    const res = await registerR2Video({
      ideaId, kind, key: slot.key!, name: file.name, sizeBytes: file.size, mimeType: file.type || 'video/mp4',
    })
    if (res.error) throw new Error(res.error)
    // QC IA solo del corte final. void: si falla, la subida ya está completa.
    if (kind === 'edited' && res.id) void analyzeUploadedVideo(res.id, file)
```

`components/video-pipeline/editor-video-card.tsx` — en `uploadOne` (siempre es `edited` aquí):

```ts
    const res = await registerR2Video({ ideaId, kind: 'edited', key: slot.key!, name: file.name, sizeBytes: file.size, mimeType: file.type || 'video/mp4' })
    if (res.error) throw new Error(res.error)
    if (res.id) void analyzeUploadedVideo(res.id, file)
```

`components/pipeline/use-submit-videos.ts` — en `deps.registerVideo` (el `file` está en el input `i` de `submit-upload-core`; si `SubmitDeps.registerVideo` no recibe el `File`, extender `SubmitDeps`/`submitOneVideo` en `lib/utils/submit-upload-core.ts` para pasarlo — cambio mínimo, mismo patrón):

```ts
  registerVideo: async (i) => {
    const res = await registerEntregasVideo({ ideaId: i.ideaId, key: i.key, name: i.name, sizeBytes: i.sizeBytes, mimeType: i.mimeType })
    if (res.ok && res.id && i.file) void analyzeUploadedVideo(res.id, i.file)
    return res
  },
```

Imports en los tres archivos: `import { analyzeUploadedVideo } from '@/lib/utils/video-analysis-client'`.

- [ ] **Step 4: Verificar verde + suites tocadas + tsc**

Run: `npx vitest run components/recording/idea-video-panel.test.tsx lib/utils/submit-upload-core.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS (incluida la suite existente de submit-upload-core si se extendió).

- [ ] **Step 5: Commit**

```bash
git add components/recording/idea-video-panel.tsx components/video-pipeline/editor-video-card.tsx components/pipeline/use-submit-videos.ts lib/utils/submit-upload-core.ts components/recording/idea-video-panel.test.tsx
git commit -m "feat(qc-video): los tres uploaders de editado disparan el análisis IA"
```

---

### Task 9: Barrido de seguridad en el cron `video-health`

**Files:**
- Create: `lib/utils/video-analysis-sweep.ts`
- Test: `lib/utils/video-analysis-sweep.test.ts`
- Modify: `app/api/cron/video-health/route.ts` (añadir el barrido al final del handler)

**Interfaces:**
- Consumes: Task 1 (tabla).
- Produces: `staleAnalysisCandidates(videos: { id: string; idea_id: string; uploaded_at: string }[], analyses: { video_id: string; status: string; updated_at: string }[], now: Date): { videoId: string; ideaId: string }[]` — editados subidos hace >30 min sin fila `done`/`error` (sin fila, o `pending` estancado).

- [ ] **Step 1: Test fallando**

```ts
// lib/utils/video-analysis-sweep.test.ts
import { describe, it, expect } from 'vitest'
import { staleAnalysisCandidates } from './video-analysis-sweep'

const now = new Date('2026-08-15T12:00:00Z')
const old = '2026-08-15T11:00:00Z'      // hace 1h
const recent = '2026-08-15T11:45:00Z'   // hace 15min
const vid = (id: string, uploaded_at: string) => ({ id, idea_id: `idea-${id}`, uploaded_at })

describe('staleAnalysisCandidates', () => {
  it('editado viejo SIN fila de análisis → candidato', () => {
    expect(staleAnalysisCandidates([vid('a', old)], [], now)).toEqual([{ videoId: 'a', ideaId: 'idea-a' }])
  })
  it('pending estancado (>30min) → candidato; done/error → no', () => {
    const vids = [vid('a', old), vid('b', old), vid('c', old)]
    const rows = [
      { video_id: 'a', status: 'pending', updated_at: old },
      { video_id: 'b', status: 'done', updated_at: old },
      { video_id: 'c', status: 'error', updated_at: old },
    ]
    expect(staleAnalysisCandidates(vids, rows, now)).toEqual([{ videoId: 'a', ideaId: 'idea-a' }])
  })
  it('subida reciente o pending fresco → aún no es candidato', () => {
    const rows = [{ video_id: 'b', status: 'pending', updated_at: recent }]
    expect(staleAnalysisCandidates([vid('a', recent), vid('b', old)], rows, now)).toEqual([])
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run lib/utils/video-analysis-sweep.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// lib/utils/video-analysis-sweep.ts
/**
 * Red de seguridad del QC IA: si el editor cerró el tab antes de mandar los
 * frames, la fila queda pending (o ni existe). Pasados 30 min ya no van a
 * llegar — el cron los marca 'error' para que el reporte no diga "Analizando…"
 * para siempre. No hay reintento server-side: sin el File local no hay frames.
 */

const STALE_MS = 30 * 60 * 1000

export function staleAnalysisCandidates(
  videos: { id: string; idea_id: string; uploaded_at: string }[],
  analyses: { video_id: string; status: string; updated_at: string }[],
  now: Date,
): { videoId: string; ideaId: string }[] {
  const byVideo = new Map(analyses.map((a) => [a.video_id, a]))
  const isOld = (iso: string) => now.getTime() - new Date(iso).getTime() > STALE_MS
  return videos
    .filter((v) => {
      if (!isOld(v.uploaded_at)) return false
      const row = byVideo.get(v.id)
      if (!row) return true
      return row.status === 'pending' && isOld(row.updated_at)
    })
    .map((v) => ({ videoId: v.id, ideaId: v.idea_id }))
}
```

- [ ] **Step 4: Integrar en `app/api/cron/video-health/route.ts`**

Al final del handler existente (antes del `return` de éxito), añadir un bloque best-effort con el mismo cliente Supabase que ya usa la ruta:

```ts
  // QC IA: cerrar análisis que nunca van a llegar (editor cerró el tab).
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: edited }, { data: analyses }] = await Promise.all([
      supabase.from('content_idea_videos')
        .select('id, idea_id, uploaded_at')
        .eq('kind', 'edited').neq('status', 'archived').gte('uploaded_at', since),
      supabase.from('content_idea_video_analysis')
        .select('video_id, status, updated_at').gte('updated_at', since),
    ])
    const stale = staleAnalysisCandidates(edited ?? [], analyses ?? [], new Date())
    for (const s of stale) {
      await supabase.from('content_idea_video_analysis').upsert(
        {
          video_id: s.videoId, idea_id: s.ideaId, status: 'error',
          error_note: 'No se recibieron frames (posible tab cerrado durante la subida).',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'video_id' },
      )
    }
  } catch { /* best-effort: el health-check principal no depende de esto */ }
```

(Import: `import { staleAnalysisCandidates } from '@/lib/utils/video-analysis-sweep'`. Si la ruta usa otro nombre para su cliente Supabase, usar ese.)

- [ ] **Step 5: Verificar verde + tsc**

Run: `npx vitest run lib/utils/video-analysis-sweep.test.ts --exclude '**/.claude/**' && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/video-analysis-sweep.ts lib/utils/video-analysis-sweep.test.ts app/api/cron/video-health/route.ts
git commit -m "feat(qc-video): el cron video-health cierra análisis huérfanos"
```

---

### Task 10: Env, versión, changelog, preview y cierre

**Files:**
- Modify: `.env.example` (documentar `GROK_VISION_MODEL` opcional)
- Modify: `lib/version.ts` (`'3.34'` → `'3.35'`)
- Modify: `CHANGELOG.md` (bloque `## v3.35`)
- Create: `public/previews/v3.35-qc-video-ia.html`

- [ ] **Step 1: Documentar env en `.env.example`**

Junto a `GROK_CAPTION_MODEL`, añadir:

```bash
# Modelo de visión para el QC del video editado (default grok-4.6)
# GROK_VISION_MODEL=grok-4.6
```

- [ ] **Step 2: Bump + changelog**

`lib/version.ts`: `export const APP_VERSION = '3.35'`.

`CHANGELOG.md`, arriba del bloque v3.34:

```markdown
## v3.35

**La IA ahora revisa cada video editado antes de aprobarlo.**

- Al subir el editor la versión final, la IA (Grok 4.6) mira el video: lee los captions que van dentro del video y avisa si tienen errores de ortografía o gramática.
- También verifica que el contenido del video corresponda al cliente.
- El resultado aparece como un reporte junto al video en la pantalla de aprobación — la IA nunca aprueba ni rechaza sola.
- El caption ahora se escribe sabiendo lo que se VE en el video, no solo lo que se oye.
```

- [ ] **Step 3: Preview HTML**

Crear `public/previews/v3.35-qc-video-ia.html`: página standalone dark Nate Media (negro + dorado), con el reporte en sus dos estados — uno con ⚠ (2 errores de tilde + relevancia "Revisar" con detalles expandidos) y uno con ✓✓ ("Sin errores" / "Relevante para el cliente") — usando el mismo copy español del componente de Task 7.

- [ ] **Step 4: Verificación completa (double-check pre-cierre)**

Run:
```bash
npx vitest run --exclude '**/.claude/**'
npx tsc --noEmit
npm run check:db-relationships
```
Expected: toda la suite verde (línea base + nuevos), tsc limpio, guard de relaciones verde.

- [ ] **Step 5: Commit + PR**

```bash
git add .env.example lib/version.ts CHANGELOG.md public/previews/v3.35-qc-video-ia.html
git commit -m "chore(release): v3.35 — QC IA del video editado con Grok 4.6"
git push -u origin eric/video-qc-grok
gh pr create --title "QC IA del video editado con Grok 4.6 (v3.35)" --body "Ver docs/superpowers/specs/2026-08-15-video-qc-grok-design.md"
```

Tras abrir el PR: esperar checks (`test`, `merge-gate`, relationship-guard) verdes. Recordar a Eric: **aplicar `0061_video_analysis.sql` en el SQL Editor de prod** (junto con la 0060 pendiente).
