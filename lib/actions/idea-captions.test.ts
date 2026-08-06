/**
 * Coverage for the `topicOverride` extension of generateIdeaCaption (Task 4,
 * Step 4): when the idea has no hook yet, a caller-supplied topicOverride
 * (e.g. the topic Grok's scene-check inferred from the uploaded video) is
 * used as the effective hook instead of failing with "Di de qué es el video".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/server', () => ({ requirePermission: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn(async () => {}) }))

vi.mock('@/lib/integrations/metricool-style', () => ({
  fetchClientStyleExamples: vi.fn(async () => []),
}))
vi.mock('@/lib/integrations/caption-learning', () => ({
  fetchApprovedCaptionExamples: vi.fn(async () => []),
  fetchCaptionFeedbackForPrompt: vi.fn(async () => ({ loved: [], avoid: [] })),
}))
vi.mock('@/lib/llm/caption-llm', () => ({
  captionConfigError: vi.fn(() => null),
  generateCaptionText: vi.fn(async () => 'caption generado'),
}))

// Capture exactly what reaches the prompt builder — this is what proves
// `effectiveHook` (not raw idea.hook) flows through.
const mockBuildPrompt = vi.fn((_input: unknown) => 'PROMPT')
vi.mock('@/lib/utils/idea-caption-prompt', () => ({
  buildIdeaCaptionPrompt: (a: unknown) => mockBuildPrompt(a),
}))

type Row = Record<string, unknown>
let ideaRow: Row | null
let updateCalls: Array<{ table: string; values: Row }>
function makeSupabase() {
  return {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: ideaRow, error: null }) }) }),
        update(values: Row) {
          updateCalls.push({ table, values })
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  }
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeSupabase() }))

import { generateIdeaCaption } from './idea-captions'

beforeEach(() => {
  vi.clearAllMocks()
  updateCalls = []
  mockBuildPrompt.mockReturnValue('PROMPT')
})

describe('generateIdeaCaption — topicOverride', () => {
  it('idea sin hook + topicOverride → genera usando el override como hook', async () => {
    ideaRow = { id: 'idea-1', client_id: 'c1', hook: null, client: {} }
    const res = await generateIdeaCaption('idea-1', { topicOverride: 'video de pizzas artesanales' })
    expect(res.ok).toBe(true)
    expect(res.caption).toBe('caption generado')
    expect(mockBuildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ hook: 'video de pizzas artesanales' }),
    )
    expect(updateCalls.some((c) => c.table === 'content_ideas')).toBe(true)
  })

  it('idea sin hook y sin topicOverride → error, no genera', async () => {
    ideaRow = { id: 'idea-1', client_id: 'c1', hook: null, client: {} }
    const res = await generateIdeaCaption('idea-1')
    expect(res.error).toBe('Di de qué es el video para generar el caption.')
    expect(mockBuildPrompt).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(0)
  })

  it('idea CON hook + topicOverride → el hook existente gana, el override se ignora', async () => {
    ideaRow = { id: 'idea-1', client_id: 'c1', hook: 'promo original', client: {} }
    const res = await generateIdeaCaption('idea-1', { topicOverride: 'otro tema distinto' })
    expect(res.ok).toBe(true)
    expect(mockBuildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ hook: 'promo original' }),
    )
  })

  it('idea sin hook + topicOverride en blanco → error, no genera', async () => {
    ideaRow = { id: 'idea-1', client_id: 'c1', hook: null, client: {} }
    const res = await generateIdeaCaption('idea-1', { topicOverride: '   ' })
    expect(res.error).toBe('Di de qué es el video para generar el caption.')
    expect(mockBuildPrompt).not.toHaveBeenCalled()
  })
})
