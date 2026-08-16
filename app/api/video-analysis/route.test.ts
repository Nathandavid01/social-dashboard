import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))

const analyzeVideoFrames = vi.fn()
vi.mock('@/lib/llm/video-analysis', () => ({
  analyzeVideoFrames: (frames: string[], ctx: unknown, timestamps?: number[]) =>
    analyzeVideoFrames(frames, ctx, timestamps),
  videoAnalysisModelId: () => 'grok-4.6',
}))

/** Ordered log of every side effect the route performs against Supabase / the caption chain,
 *  so tests can assert both content AND relative order (pending-before-done, done-before-caption). */
let calls: Array<{ op: string; payload?: unknown; opts?: unknown }> = []

const generateIdeaCaption = vi.fn(async (ideaId: string, opts?: unknown) => {
  calls.push({ op: 'generateIdeaCaption', payload: [ideaId, opts] })
  return { ok: true }
})
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (ideaId: string, opts?: unknown) => generateIdeaCaption(ideaId, opts),
}))

/** Log separado de las llamadas de transcripción, para no romper `calls.map(op)`. */
let transcribeCalls: Array<{ op: string }> = []
const listenUrlForCaptionVideo = vi.fn(async (_video?: unknown) => 'https://example.com/audio.mp4' as string | null)
vi.mock('@/lib/integrations/caption-listen-url', () => ({
  listenUrlForCaptionVideo: (video: unknown) => {
    transcribeCalls.push({ op: 'listenUrl' })
    return listenUrlForCaptionVideo(video)
  },
}))
const transcribeVideoFromUrl = vi.fn(async (_url: string) => 'Transcripción de prueba' as string | null)
vi.mock('@/lib/integrations/whisper', () => ({
  transcribeVideoFromUrl: (url: string) => {
    transcribeCalls.push({ op: 'transcribe' })
    return transcribeVideoFromUrl(url)
  },
}))

let videoResult: { data: unknown } = { data: null }
/** Plain value applies to every upsert; a function receives the 0-based upsert
 *  call index so a test can fail just the pending upsert (index 0) and leave
 *  the rest healthy, without weakening the existing all-calls-fail tests. */
let upsertError: { message: string } | null | ((callIndex: number) => { message: string } | null) = null
/** Findings ya persistidos en la fila, leídos por el merge de un chunk > 0. */
let existingFindings: unknown = null
/** frame_count ya persistido en la fila, leído junto con findings (misma fila). */
let existingFrameCount: number | null = null
/** Log SEPARADO (no `calls`) del UPDATE best-effort de frame_count, para no
 *  romper las ~15 aserciones existentes de `calls.map(op)`. */
let frameCountUpdates: Array<{ payload: Record<string, unknown>; videoId?: string }> = []
/** Simula "la columna frame_count no existe todavía" (migración 0063 pendiente). */
let frameCountUpdateThrows = false
/** Log SEPARADO de los UPDATE best-effort sobre content_ideas (hook / hook_source). */
let hookUpdates: Array<{ payload: Record<string, unknown>; id?: string }> = []
/** Simula "la columna hook_source no existe todavía" (migración 0064 pendiente):
 *  solo el UPDATE que trae hook_source lanza — el UPDATE del hook en sí sigue vivo. */
let hookSourceUpdateThrows = false
/** Simula TOCTOU: una persona escribió el hook A MANO mientras analyzeVideoFrames
 *  corría — el UPDATE condicional (`.is('hook', null)`) no matchea ninguna fila. */
let hookUpdateNoMatch = false

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'content_idea_videos') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => videoResult,
            }),
          }),
        }
      }
      if (table === 'content_idea_video_analysis') {
        return {
          upsert: (payload: Record<string, unknown>, opts: unknown) => {
            const callIndex = calls.filter((c) => c.op === 'upsert').length
            calls.push({ op: 'upsert', payload, opts })
            const error = typeof upsertError === 'function' ? upsertError(callIndex) : upsertError
            return Promise.resolve({ error })
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                calls.push({ op: 'select-findings' })
                return { data: { findings: existingFindings, frame_count: existingFrameCount }, error: null }
              },
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, videoId: string) => {
              if (frameCountUpdateThrows) throw new Error('column "frame_count" does not exist')
              frameCountUpdates.push({ payload, videoId })
              return { error: null }
            },
          }),
        }
      }
      if (table === 'content_ideas') {
        return {
          // `.eq()` es un thenable (para el UPDATE directo de hook_source,
          // que se awaitea sin encadenar más) que TAMBIÉN expone `.is()` (para
          // el UPDATE condicional del hook: `.eq('id', id).is('hook', null).select('id')`).
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              const commit = async () => {
                if ('hook_source' in payload && hookSourceUpdateThrows) {
                  throw new Error('column "hook_source" does not exist')
                }
                hookUpdates.push({ payload, id })
                return { error: null }
              }
              return {
                is: (_col2: string, _val: null) => ({
                  select: async (_cols: string) => {
                    if (hookUpdateNoMatch) return { data: [], error: null }
                    hookUpdates.push({ payload, id })
                    return { data: [{ id }], error: null }
                  },
                }),
                then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
                  commit().then(resolve, reject)
                },
              }
            },
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from './route'

const IDEA = {
  id: 'idea-1', title: 'Título', hook: 'hook',
  client: { name: 'Cliente', brand_voice: 'voz', caption_language: 'es', caption_notes: null },
}
const VIDEO = {
  id: 'video-1', idea_id: 'idea-1', kind: 'edited', idea: IDEA,
  drive_file_id: 'edited/video-1.mp4', storage_provider: 'entregas-r2',
}
const FRAME = 'data:image/jpeg;base64,AAAA'
const GOOD_FINDINGS = {
  burned_captions: { text: 'Ven hoy', issues: [] },
  relevance: { verdict: 'ok', explanation: 'coincide' },
  visual_summary: 'persona a cámara',
}

function req(body: unknown) {
  return new Request('http://localhost/api/video-analysis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  calls = []
  videoResult = { data: VIDEO }
  upsertError = null
  existingFindings = null
  existingFrameCount = null
  frameCountUpdates = []
  frameCountUpdateThrows = false
  hookUpdates = []
  hookSourceUpdateThrows = false
  hookUpdateNoMatch = false
  transcribeCalls = []
  requirePermission.mockReset().mockResolvedValue(undefined)
  analyzeVideoFrames.mockReset().mockResolvedValue(GOOD_FINDINGS)
  generateIdeaCaption.mockReset().mockImplementation(async (ideaId: string, opts?: unknown) => {
    calls.push({ op: 'generateIdeaCaption', payload: [ideaId, opts] })
    return { ok: true }
  })
  listenUrlForCaptionVideo.mockReset().mockResolvedValue('https://example.com/audio.mp4')
  transcribeVideoFromUrl.mockReset().mockResolvedValue('Transcripción de prueba')
})

describe('POST /api/video-analysis', () => {
  it('403 cuando requirePermission lanza', async () => {
    requirePermission.mockRejectedValueOnce(new Error('nope'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(403)
    expect(calls).toEqual([])
    expect(analyzeVideoFrames).not.toHaveBeenCalled()
  })

  it('400 cuando falta videoId', async () => {
    const res = await POST(req({ frames: [FRAME] }))
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('400 cuando frames está vacío', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [] }))
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('400 cuando todos los frames son inválidos (se filtran)', async () => {
    const res = await POST(
      req({ videoId: 'video-1', frames: ['not-a-data-uri', 'data:image/png;base64,AAAA'] }),
    )
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('404 cuando el video no existe', async () => {
    videoResult = { data: null }
    const res = await POST(req({ videoId: 'missing', frames: [FRAME] }))
    expect(res.status).toBe(404)
    expect(calls).toEqual([])
  })

  it("404 cuando kind !== 'edited'", async () => {
    videoResult = { data: { ...VIDEO, kind: 'raw' } }
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(404)
    expect(calls).toEqual([])
  })

  it('éxito: upsert pending → upsert done con findings/visual_summary/model, onConflict video_id, y encadena generateIdeaCaption DESPUÉS del done', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })

    // Exactly 3 side effects, in order: pending upsert, done upsert, then the caption chain.
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'generateIdeaCaption'])

    const pending = calls[0].payload as Record<string, unknown>
    expect(pending).toMatchObject({
      video_id: 'video-1', idea_id: 'idea-1', status: 'pending',
      findings: null, visual_summary: null, error_note: null,
    })
    expect(calls[0].opts).toEqual({ onConflict: 'video_id' })

    const done = calls[1].payload as Record<string, unknown>
    expect(done).toMatchObject({
      video_id: 'video-1', idea_id: 'idea-1', status: 'done',
      findings: GOOD_FINDINGS, visual_summary: GOOD_FINDINGS.visual_summary, model: 'grok-4.6',
    })
    expect(calls[1].opts).toEqual({ onConflict: 'video_id' })

    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('timestamps válidos (misma longitud que frames tras filtro): llegan a analyzeVideoFrames', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], timestamps: [1.5] }))
    expect(res.status).toBe(200)
    expect(analyzeVideoFrames).toHaveBeenCalledWith([FRAME], expect.anything(), [1.5])
  })

  it('timestamps de longitud distinta a frames: se ignoran, sigue 200', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], timestamps: [1.5, 2.5] }))
    expect(res.status).toBe(200)
    expect(analyzeVideoFrames).toHaveBeenCalledWith([FRAME], expect.anything(), undefined)
  })

  it('video sin idea/cliente: usa defaults sin lanzar', async () => {
    videoResult = { data: { id: 'video-1', idea_id: 'idea-1', kind: 'edited', idea: null } }
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(analyzeVideoFrames).toHaveBeenCalledWith([FRAME], expect.objectContaining({
      ideaTitle: 'Sin título', hook: undefined, clientName: undefined,
    }), undefined)
  })

  it('analyzeVideoFrames lanza → upsert error con error_note, 502, y NO encadena generateIdeaCaption', async () => {
    analyzeVideoFrames.mockRejectedValueOnce(new Error('Grok API 429: rate'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: 'El análisis falló' })

    const upserts = calls.filter((c) => c.op === 'upsert')
    expect(upserts).toHaveLength(2)
    const errorUpsert = upserts[1].payload as Record<string, unknown>
    expect(errorUpsert).toMatchObject({ status: 'error', error_note: 'Grok API 429: rate' })

    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('upsert pending falla → 503 y NO gasta la llamada a Grok (analyzeVideoFrames no se invoca)', async () => {
    upsertError = (callIndex) => (callIndex === 0 ? { message: 'db down' } : null)
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({ error: 'Análisis no disponible' })

    expect(analyzeVideoFrames).not.toHaveBeenCalled()
    expect(calls.map((c) => c.op)).toEqual(['upsert'])
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('generateIdeaCaption rechaza → la ruta igual responde 200 (best-effort)', async () => {
    generateIdeaCaption.mockRejectedValueOnce(new Error('falta hook'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })
})

describe('POST /api/video-analysis — troceado (chunk)', () => {
  const chunkFindings = (text: string, summary: string) => ({
    burned_captions: { text, issues: [] },
    relevance: { verdict: 'ok', explanation: 'coincide' },
    visual_summary: summary,
  })

  it('chunk único (sin campo chunk): comportamiento actual intacto — pending, done, encadena caption', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'generateIdeaCaption'])
  })

  it('chunk 0 de 3: pending → done con SOLO este chunk (sin merge, no hay fila previa) → NO encadena caption', async () => {
    analyzeVideoFrames.mockResolvedValueOnce(chunkFindings('Ven hoy', 'persona cocina'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 0, total: 3 } }))
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert'])

    const pending = calls[0].payload as Record<string, unknown>
    expect(pending).toMatchObject({ status: 'pending' })

    const done = calls[1].payload as Record<string, unknown>
    expect(done).toMatchObject({
      status: 'done',
      findings: chunkFindings('Ven hoy', 'persona cocina'),
      visual_summary: 'persona cocina',
    })
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('chunk 2 de 3 (último): NO pending, lee findings previos, funde, escribe done, y SÍ encadena caption', async () => {
    existingFindings = chunkFindings('Ven hoy al gym', 'persona cocina picanha')
    analyzeVideoFrames.mockResolvedValueOnce(chunkFindings('cierra con el logo', 'cierra con el logo de Arasibo'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 2, total: 3 } }))
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.op)).toEqual(['select-findings', 'upsert', 'generateIdeaCaption'])

    const done = calls[1].payload as Record<string, unknown>
    const findings = done.findings as { burned_captions: { text: string }; visual_summary: string }
    expect(findings.burned_captions.text).toBe('Ven hoy al gym cierra con el logo')
    expect(findings.visual_summary).toBe('persona cocina picanha cierra con el logo de Arasibo')
    expect(done.visual_summary).toBe(findings.visual_summary)
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('chunk con forma inválida: se trata como chunk único (pending+done+encadena)', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 'x', total: 3 } }))
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'generateIdeaCaption'])
  })

  it('chunk con index fuera de rango (index >= total): se trata como chunk único', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 5, total: 3 } }))
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'generateIdeaCaption'])
  })

  it('chunk > 0 falla en analyzeVideoFrames: 502, NO escribe status error (no clobber de la fila con findings válidos), NO encadena', async () => {
    existingFindings = chunkFindings('Ven hoy', 'persona cocina')
    analyzeVideoFrames.mockRejectedValueOnce(new Error('Grok API 429: rate'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 1, total: 3 } }))
    expect(res.status).toBe(502)
    expect(calls.map((c) => c.op)).toEqual(['select-findings'])
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })
})

describe('POST /api/video-analysis — frame_count (contador de fotogramas)', () => {
  it('chunk único (sin campo chunk): escribe frame_count = cantidad de frames de este request', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(frameCountUpdates).toEqual([{ payload: { frame_count: 1 }, videoId: 'video-1' }])
  })

  it('chunk 0 de 3: frame_count = solo los frames de este chunk (sin previo que sumar)', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 0, total: 3 } }))
    expect(res.status).toBe(200)
    expect(frameCountUpdates).toEqual([{ payload: { frame_count: 1 }, videoId: 'video-1' }])
  })

  it('chunk 2 de 3 (último): frame_count = previo (leído de la misma fila) + los de este chunk', async () => {
    existingFrameCount = 47
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 2, total: 3 } }))
    expect(res.status).toBe(200)
    expect(frameCountUpdates).toEqual([{ payload: { frame_count: 48 }, videoId: 'video-1' }])
  })

  it('sin frame_count previo (columna nueva, fila vieja): trata el previo como 0', async () => {
    existingFrameCount = null
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 1, total: 3 } }))
    expect(res.status).toBe(200)
    expect(frameCountUpdates).toEqual([{ payload: { frame_count: 1 }, videoId: 'video-1' }])
  })

  it('columna frame_count no existe todavía (UPDATE lanza) → el análisis igual responde 200 y encadena caption', async () => {
    frameCountUpdateThrows = true
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(frameCountUpdates).toEqual([]) // nunca llegó a registrarse: el UPDATE lanzó
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'generateIdeaCaption'])
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('el UPDATE de frame_count ocurre DESPUÉS del upsert done exitoso (nunca antes de persistir status/findings)', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    // 2 upserts (pending, done) ya sucedieron para cuando frameCountUpdates se llenó.
    const doneUpserts = calls.filter((c) => c.op === 'upsert')
    expect(doneUpserts).toHaveLength(2)
    expect(frameCountUpdates).toHaveLength(1)
  })
})

describe('POST /api/video-analysis — video_topic escribe el hook ("¿De qué es este video?")', () => {
  const findingsWithTopic = (topic: string) => ({
    burned_captions: { text: 'Ven hoy', issues: [] },
    relevance: { verdict: 'ok', explanation: 'coincide' },
    visual_summary: 'persona a cámara',
    video_topic: topic,
  })

  it('hook vacío + video_topic → escribe hook y hook_source=\'ai\', DESPUÉS del upsert done y ANTES de generateIdeaCaption', async () => {
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    analyzeVideoFrames.mockResolvedValueOnce(findingsWithTopic('Cómo sellar una picanha en parrilla Santa María'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)

    expect(hookUpdates).toEqual([
      { payload: { hook: 'Cómo sellar una picanha en parrilla Santa María' }, id: 'idea-1' },
      { payload: { hook_source: 'ai' }, id: 'idea-1' },
    ])
    // El upsert 'done' (calls[1]) ya sucedió antes de tocar content_ideas, y el
    // caption se encadena después de escribir el hook.
    const upsertCount = calls.filter((c) => c.op === 'upsert').length
    expect(upsertCount).toBe(2)
    expect(calls[calls.length - 1]).toEqual({ op: 'generateIdeaCaption', payload: ['idea-1', { auto: true }] })
  })

  it('hook con texto humano → NO lo toca, aunque venga video_topic (el UPDATE condicional .is(\'hook\',null) no matchea)', async () => {
    // IDEA por defecto ya trae hook: 'hook' (texto humano) → en la DB real
    // el filtro .is('hook', null) no matchearía ninguna fila.
    hookUpdateNoMatch = true
    analyzeVideoFrames.mockResolvedValueOnce(findingsWithTopic('Cómo sellar una picanha'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(hookUpdates).toEqual([])
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('TOCTOU: el hook cambia a mano ENTRE la lectura inicial (vacío) y el write (analyzeVideoFrames tardó) → no pisa, no marca, y el caption se encadena igual', async () => {
    // La lectura del principio de la petición ve el hook vacío (analysisCtx
    // usa esto solo para el prompt), pero mientras `analyzeVideoFrames`
    // corre, una persona lo llena — así que el UPDATE condicional en la
    // PROPIA query (.is('hook', null)) ya no matchea ninguna fila para
    // cuando llega el momento de escribir.
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    hookUpdateNoMatch = true
    analyzeVideoFrames.mockResolvedValueOnce(findingsWithTopic('Cómo sellar una picanha en parrilla Santa María'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)

    // (a) hook_source nunca se escribe
    expect(hookUpdates.some((u) => 'hook_source' in u.payload)).toBe(false)
    // (b) el texto humano no se pierde: ni siquiera se intenta un write que gane la carrera
    expect(hookUpdates).toEqual([])
    // (c) el caption se encadena igual (y generateIdeaCaption lee el hook humano ya persistido)
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('sin video_topic en los findings → no escribe nada en content_ideas', async () => {
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    // GOOD_FINDINGS (default mock) no trae video_topic.
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(hookUpdates).toEqual([])
  })

  it('el UPDATE de hook_source falla (columna sin migrar) → el hook igual se escribe y el caption se encadena igual', async () => {
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    hookSourceUpdateThrows = true
    analyzeVideoFrames.mockResolvedValueOnce(findingsWithTopic('Cómo sellar una picanha'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(hookUpdates).toEqual([{ payload: { hook: 'Cómo sellar una picanha' }, id: 'idea-1' }])
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })

  it('con troceado: chunk 0 de 3 (no es el último) NO escribe el hook aunque traiga video_topic', async () => {
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    analyzeVideoFrames.mockResolvedValueOnce(findingsWithTopic('Cómo sellar una picanha'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 0, total: 3 } }))
    expect(res.status).toBe(200)
    expect(hookUpdates).toEqual([])
  })

  it('con troceado: solo el ÚLTIMO chunk escribe, usando el video_topic ya fundido de chunks previos', async () => {
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    existingFindings = { ...findingsWithTopic('Cómo sellar una picanha'), }
    // El chunk final no trae video_topic propio — el merge conserva el del previo.
    analyzeVideoFrames.mockResolvedValueOnce({
      burned_captions: { text: 'cierra con logo', issues: [] },
      relevance: { verdict: 'ok', explanation: 'coincide' },
      visual_summary: 'cierra con el logo',
    })
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 2, total: 3 } }))
    expect(res.status).toBe(200)
    expect(hookUpdates).toEqual([
      { payload: { hook: 'Cómo sellar una picanha' }, id: 'idea-1' },
      { payload: { hook_source: 'ai' }, id: 'idea-1' },
    ])
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })
})

describe('POST /api/video-analysis — transcripción (escucha el video en paralelo)', () => {
  it('chunk único: pide la transcripción y la pasa a analyzeVideoFrames en el ctx', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(listenUrlForCaptionVideo).toHaveBeenCalledTimes(1)
    expect(transcribeVideoFromUrl).toHaveBeenCalledTimes(1)
    expect(analyzeVideoFrames).toHaveBeenCalledWith(
      [FRAME],
      expect.objectContaining({ transcript: 'Transcripción de prueba' }),
      undefined,
    )
  })

  it('chunk 0 de 3 (primero): también pide la transcripción', async () => {
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 0, total: 3 } }))
    expect(res.status).toBe(200)
    expect(transcribeVideoFromUrl).toHaveBeenCalledTimes(1)
    expect(analyzeVideoFrames).toHaveBeenCalledWith(
      [FRAME],
      expect.objectContaining({ transcript: 'Transcripción de prueba' }),
      undefined,
    )
  })

  it('chunk > 0 (no es el primero): NO vuelve a pedir la transcripción', async () => {
    existingFindings = GOOD_FINDINGS
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME], chunk: { index: 1, total: 3 } }))
    expect(res.status).toBe(200)
    expect(listenUrlForCaptionVideo).not.toHaveBeenCalled()
    expect(transcribeVideoFromUrl).not.toHaveBeenCalled()
    expect(analyzeVideoFrames).toHaveBeenCalledWith(
      [FRAME],
      expect.objectContaining({ transcript: null }),
      undefined,
    )
  })

  it('sin URL de audio (listenUrlForCaptionVideo → null): transcript null, sigue solo con lo visual', async () => {
    listenUrlForCaptionVideo.mockResolvedValueOnce(null)
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(transcribeVideoFromUrl).not.toHaveBeenCalled()
    expect(analyzeVideoFrames).toHaveBeenCalledWith(
      [FRAME],
      expect.objectContaining({ transcript: null }),
      undefined,
    )
  })

  it('Whisper falla (rechaza): el análisis y la escritura del hook siguen igual, best-effort', async () => {
    transcribeVideoFromUrl.mockRejectedValueOnce(new Error('whisper 500'))
    videoResult = { data: { ...VIDEO, idea: { ...IDEA, hook: '' } } }
    analyzeVideoFrames.mockResolvedValueOnce({
      ...GOOD_FINDINGS,
      video_topic: 'Cómo sellar una picanha',
    })
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(analyzeVideoFrames).toHaveBeenCalledWith(
      [FRAME],
      expect.objectContaining({ transcript: null }),
      undefined,
    )
    expect(hookUpdates).toEqual([
      { payload: { hook: 'Cómo sellar una picanha' }, id: 'idea-1' },
      { payload: { hook_source: 'ai' }, id: 'idea-1' },
    ])
  })
})
