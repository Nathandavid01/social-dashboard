import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))

const analyzeVideoFrames = vi.fn()
vi.mock('@/lib/llm/video-analysis', () => ({
  analyzeVideoFrames: (frames: string[], ctx: unknown) => analyzeVideoFrames(frames, ctx),
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

let videoResult: { data: unknown } = { data: null }
let upsertError: { message: string } | null = null

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
            calls.push({ op: 'upsert', payload, opts })
            return Promise.resolve({ error: upsertError })
          },
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
const VIDEO = { id: 'video-1', idea_id: 'idea-1', kind: 'edited', idea: IDEA }
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
  requirePermission.mockReset().mockResolvedValue(undefined)
  analyzeVideoFrames.mockReset().mockResolvedValue(GOOD_FINDINGS)
  generateIdeaCaption.mockReset().mockImplementation(async (ideaId: string, opts?: unknown) => {
    calls.push({ op: 'generateIdeaCaption', payload: [ideaId, opts] })
    return { ok: true }
  })
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

  it('video sin idea/cliente: usa defaults sin lanzar', async () => {
    videoResult = { data: { id: 'video-1', idea_id: 'idea-1', kind: 'edited', idea: null } }
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    expect(analyzeVideoFrames).toHaveBeenCalledWith([FRAME], expect.objectContaining({
      ideaTitle: 'Sin título', hook: undefined, clientName: undefined,
    }))
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

  it('generateIdeaCaption rechaza → la ruta igual responde 200 (best-effort)', async () => {
    generateIdeaCaption.mockRejectedValueOnce(new Error('falta hook'))
    const res = await POST(req({ videoId: 'video-1', frames: [FRAME] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(generateIdeaCaption).toHaveBeenCalledWith('idea-1', { auto: true })
  })
})
