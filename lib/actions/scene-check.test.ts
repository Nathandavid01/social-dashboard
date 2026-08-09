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
let videoRow: Row | null
let updateError: { message: string } | null
let updateCalls: Array<{ table: string; values: Row }>
function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      return {
        update(values: Row) {
          updateCalls.push({ table, values })
          return { eq: async () => ({ error: updateError }) }
        },
        select() {
          return {
            eq: () => ({
              single: async () => ({
                data: table === 'content_idea_videos' ? videoRow : ideaRow,
                error: null,
              }),
            }),
          }
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
  json: async () => ({
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
  }),
})

const grokPayload = (overrides: Record<string, unknown> = {}) => ({
  issues: [],
  videoTopic: 'pizzas',
  clientMatchStatus: 'match',
  clientMatchReason: 'El logo y el producto coinciden.',
  clientMatchEvidence: ['Logo Acme visible'],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  updateCalls = []
  updateError = null
  ideaRow = {
    id: 'idea-1',
    title: 'Pizza del viernes',
    hook: 'promo pizzas',
    visual_brief: 'Mostrar el horno',
    generated_caption: null,
    client: { name: 'Acme Pizza', industry: 'Restaurante', brand_voice: 'Familiar' },
  }
  videoRow = { id: 'v1', kind: 'edited', idea_id: 'idea-1' }
  process.env.XAI_API_KEY = 'test-key'
  // clearAllMocks() resets call history but NOT queued implementations
  // (mockRejectedValue/mockResolvedValue survive it) — re-arm the happy path
  // each test so a prior test's rejection can't leak into the next one.
  mockRequirePermission.mockResolvedValue(undefined)
  mockGenerateIdeaCaption.mockResolvedValue({ ok: true, caption: 'caption!' })
})

describe('analyzeUploadedVideo', () => {
  it('guarda reporte ok cuando no hay issues', async () => {
    fetchMock.mockResolvedValue(grokJson(grokPayload()))
    const { analyzeUploadedVideo } = await import('./scene-check')
    const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(res.ok).toBe(true)
    expect(res.report!.status).toBe('ok')
    expect(res.report!.clientMatch?.status).toBe('match')
    const saved = updateCalls.find((c) => c.table === 'content_idea_videos')!
    expect((saved.values.scene_check as { status: string }).status).toBe('ok')
  })

  it('guarda reporte issues con los errores encontrados', async () => {
    fetchMock.mockResolvedValue(grokJson(grokPayload({
      issues: [{ text: 'exelente', problem: 'excelente', frameIndex: 0 }],
      videoTopic: null,
    })))
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
    fetchMock.mockResolvedValue(grokJson(grokPayload()))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).toHaveBeenCalledWith('idea-1', expect.anything())
  })

  it('NO sobrescribe caption existente', async () => {
    ideaRow = { ...ideaRow, hook: 'promo', generated_caption: 'ya existe' }
    fetchMock.mockResolvedValue(grokJson(grokPayload()))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
  })

  it('idea sin hook → pasa videoTopic como topicOverride', async () => {
    ideaRow = { ...ideaRow, hook: null, generated_caption: null }
    fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: 'video de pizzas artesanales' })))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).toHaveBeenCalledWith('idea-1', { topicOverride: 'video de pizzas artesanales' })
  })

  it('idea sin hook y Grok sin topic → no intenta caption', async () => {
    ideaRow = { ...ideaRow, hook: null, generated_caption: null }
    fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: null })))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
  })

  it('caption falla → el reporte igual queda guardado y el action devuelve ok', async () => {
    mockGenerateIdeaCaption.mockResolvedValue({ error: 'llm down' })
    fetchMock.mockResolvedValue(grokJson(grokPayload()))
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
    fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: null })))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    expect(mockLogIdeaActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'scene_check_completed',
      metadata: expect.objectContaining({ clientMatchStatus: 'match' }),
    }))
  })

  it('envía a Grok el nombre, industria y contexto creativo del cliente', async () => {
    fetchMock.mockResolvedValue(grokJson(grokPayload()))
    const { analyzeUploadedVideo } = await import('./scene-check')
    await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    const prompt = body.input[0].content.find((c: { type: string }) => c.type === 'input_text').text
    expect(prompt).toContain('Acme Pizza')
    expect(prompt).toContain('Restaurante')
    expect(prompt).toContain('Pizza del viernes')
  })

  // ── I2: el video debe existir, ser 'edited' y pertenecer a la idea ──
  describe('validación del video (I2)', () => {
    it('video inexistente → error, sin tocar la DB', async () => {
      videoRow = null
      const { analyzeUploadedVideo } = await import('./scene-check')
      const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
      expect(res.error).toBe('Video no encontrado o no corresponde a la idea.')
      expect(updateCalls).toHaveLength(0)
      expect(mockLogIdeaActivity).not.toHaveBeenCalled()
      expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('video de otra idea → error, sin tocar la DB', async () => {
      videoRow = { id: 'v1', kind: 'edited', idea_id: 'idea-OTRA' }
      const { analyzeUploadedVideo } = await import('./scene-check')
      const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
      expect(res.error).toBe('Video no encontrado o no corresponde a la idea.')
      expect(updateCalls).toHaveLength(0)
      expect(mockLogIdeaActivity).not.toHaveBeenCalled()
    })

    it('video kind raw (no edited) → error, sin tocar la DB', async () => {
      videoRow = { id: 'v1', kind: 'raw', idea_id: 'idea-1' }
      const { analyzeUploadedVideo } = await import('./scene-check')
      const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
      expect(res.error).toBe('Video no encontrado o no corresponde a la idea.')
      expect(updateCalls).toHaveLength(0)
    })
  })

  // ── I1: límites de frames server-side ──
  describe('límites de frames server-side (I1)', () => {
    it('frame con b64 no-base64 se filtra antes de llamar a Grok', async () => {
      fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: null })))
      const bad = [{ b64: 'no-es-base64!!', second: 1 }, { b64: 'AAAA', second: 2 }]
      const { analyzeUploadedVideo } = await import('./scene-check')
      await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames: bad })
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      const imageCount = body.input[0].content.filter((c: { type: string }) => c.type === 'input_image').length
      expect(imageCount).toBe(1)
    })

    it('más de 12 frames se recortan a 12 en el request a Grok', async () => {
      fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: null })))
      const many = Array.from({ length: 20 }, (_, i) => ({ b64: 'AAAA', second: i }))
      const { analyzeUploadedVideo } = await import('./scene-check')
      await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames: many })
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      const imageCount = body.input[0].content.filter((c: { type: string }) => c.type === 'input_image').length
      expect(imageCount).toBe(12)
    })

    it('frame gigante (b64 > MAX_B64_CHARS) se filtra', async () => {
      fetchMock.mockResolvedValue(grokJson(grokPayload({ videoTopic: null })))
      const giant = [{ b64: 'A'.repeat(400_001), second: 1 }, { b64: 'AAAA', second: 2 }]
      const { analyzeUploadedVideo } = await import('./scene-check')
      await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames: giant })
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      const imageCount = body.input[0].content.filter((c: { type: string }) => c.type === 'input_image').length
      expect(imageCount).toBe(1)
    })

    it('todos los frames inválidos → reporte skipped con mensaje específico, sin llamar a Grok', async () => {
      const allBad = [{ b64: 'no-es-base64!!', second: 1 }]
      const { analyzeUploadedVideo } = await import('./scene-check')
      const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames: allBad })
      expect(res.report!.status).toBe('skipped')
      expect(res.report!.error).toBe('Frames inválidos o demasiado grandes.')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // ── M1: si el update falla, el action debe reportarlo ──
  describe('fallo al guardar el reporte (M1)', () => {
    it('update falla → devuelve error, no registra actividad ni caption', async () => {
      updateError = { message: 'db down' }
      fetchMock.mockResolvedValue(grokJson(grokPayload()))
      const { analyzeUploadedVideo } = await import('./scene-check')
      const res = await analyzeUploadedVideo({ videoId: 'v1', ideaId: 'idea-1', frames })
      expect(res.error).toBe('No se pudo guardar el reporte.')
      expect(res.ok).toBeUndefined()
      expect(mockLogIdeaActivity).not.toHaveBeenCalled()
      expect(mockGenerateIdeaCaption).not.toHaveBeenCalled()
    })
  })
})
