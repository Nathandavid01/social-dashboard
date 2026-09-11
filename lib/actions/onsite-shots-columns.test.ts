import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getOnsiteShots must keep loading when content_ideas lacks objective/funnel_stage
 * (PR #164 selected them; prod only has them on idea_lab_feedback → 400 → On Site dead-end).
 */
const state = vi.hoisted(() => ({
  selects: [] as string[],
  responses: [] as Array<{ data: unknown; error: { message: string } | null }>,
}))

vi.mock('@/lib/auth/server', () => ({ requirePermission: async () => undefined }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, any> = {}
      for (const key of ['eq', 'neq', 'is', 'in', 'gte', 'or', 'order', 'limit']) {
        b[key] = () => b
      }
      b.select = (fields: string) => {
        if (table === 'content_ideas') state.selects.push(fields)
        return b
      }
      b.single = async () => ({
        data: { id: 's1', client_id: 'c1', status: 'completed' },
        error: null,
      })
      b.then = (resolve: (v: unknown) => unknown) => {
        if (table === 'content_ideas') {
          const next = state.responses.shift() ?? { data: [], error: null }
          return resolve(next)
        }
        return resolve({ data: [], error: null })
      }
      return b
    },
  }),
}))

import { getOnsiteShots } from './onsite'

beforeEach(() => {
  state.selects = []
  state.responses = []
})

describe('getOnsiteShots column fallback', () => {
  it('cae a un select sin objective/funnel_stage cuando PostgREST responde 400', async () => {
    state.responses = [
      { data: null, error: { message: 'column content_ideas.objective does not exist' } },
      { data: null, error: { message: 'column content_ideas.objective does not exist' } },
      {
        data: [
          {
            id: 'i1',
            title: 'Promo',
            hook: 'Hook',
            visual_brief: 'Brief',
            rationale: null,
            shot_type: 'sony',
            reference_url: null,
            status: 'idea',
            shooting_notes: null,
          },
        ],
        error: null,
      },
    ]

    const result = await getOnsiteShots('s1')
    expect(result.error).toBeUndefined()
    expect(result.shots).toEqual([
      expect.objectContaining({
        id: 'i1',
        title: 'Promo',
        objective: null,
        funnelStage: null,
      }),
    ])
    expect(state.selects.some((s) => s.includes('objective'))).toBe(true)
    expect(state.selects.some((s) => !s.includes('objective') && !s.includes('funnel_stage'))).toBe(true)
  })

  it('devuelve objective cuando la columna sí existe', async () => {
    state.responses = [
      {
        data: [
          {
            id: 'i2',
            title: 'Con objetivo',
            objective: 'Aumentar reservas',
            funnel_stage: 'BOFU',
            hook: null,
            visual_brief: null,
            rationale: null,
            shot_type: null,
            reference_url: null,
            status: 'idea',
            shooting_notes: null,
          },
        ],
        error: null,
      },
    ]

    const result = await getOnsiteShots('s1')
    expect(result.error).toBeUndefined()
    expect(result.shots?.[0]).toMatchObject({
      id: 'i2',
      objective: 'Aumentar reservas',
      funnelStage: 'BOFU',
    })
  })
})
