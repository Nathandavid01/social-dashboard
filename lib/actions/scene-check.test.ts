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
  // clearAllMocks() resets call history but NOT queued implementations
  // (mockRejectedValue/mockResolvedValue survive it) — re-arm the happy path
  // each test so a prior test's rejection can't leak into the next one.
  mockRequirePermission.mockResolvedValue(undefined)
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
