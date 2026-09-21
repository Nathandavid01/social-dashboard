import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  perm: 'pipeline.claim' as string | null,
  denied: false,
  userId: 'ed-diego' as string | null,
  canAssign: false,
  idea: {} as Record<string, unknown>,
  writes: [] as Record<string, unknown>[],
  filters: [] as Array<[string, unknown]>,
  ors: [] as string[],
  claimed: [{ id: 'idea', editing_started_by: 'ed-diego', editing_started_at: '2026-09-21T16:10:00.000Z' }] as Array<Record<string, unknown>>,
  holder: null as Record<string, unknown> | null,
  profile: { id: 'ed-maria', full_name: 'María R.', avatar_url: null } as Record<string, unknown> | null,
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (h.denied || (h.perm && h.perm !== perm)) throw new Error(`Acceso denegado (falta permiso: ${perm})`)
  }),
  currentUserHas: vi.fn(async (perm: string) => perm === 'planning.assign' && h.canAssign),
  getEffectiveUserId: vi.fn(async () => h.userId),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      let write = false
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          h.filters.push([col, val])
          return q
        },
        is: (col: string, val: unknown) => {
          h.filters.push([col, val])
          return q
        },
        or: (expr: string) => {
          h.ors.push(expr)
          return q
        },
        update: (payload: Record<string, unknown>) => {
          write = true
          h.writes.push(payload)
          return q
        },
        maybeSingle: async () => {
          if (table === 'profiles') return { data: h.profile, error: null }
          return { data: h.holder, error: null }
        },
        single: async () => {
          if (table === 'profiles') return { data: h.profile, error: null }
          return { data: h.idea, error: null }
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (write) return resolve({ data: h.claimed, error: null })
          if (table === 'content_ideas') return resolve({ data: h.idea, error: null })
          if (table === 'profiles') return resolve({ data: h.profile, error: null })
          return resolve({ data: [], error: null })
        },
      }
      return q
    },
  })),
}))

import { claimPipelineEdit, releasePipelineEdit } from './pipeline-claim'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-21T16:10:00.000Z'))
  h.perm = 'pipeline.claim'
  h.denied = false
  h.userId = 'ed-diego'
  h.canAssign = false
  h.writes = []
  h.filters = []
  h.ors = []
  h.claimed = [{ id: 'idea', editing_started_by: 'ed-diego', editing_started_at: '2026-09-21T16:10:00.000Z' }]
  h.holder = null
  h.profile = { id: 'ed-maria', full_name: 'María R.', avatar_url: null }
  h.idea = { id: 'idea', editing_started_by: null, editing_started_at: null }
})

describe('claimPipelineEdit', () => {
  it('reclama un video libre con quién y cuándo', async () => {
    const result = await claimPipelineEdit('idea')
    expect(result).toEqual({
      ok: true,
      claim: { byId: 'ed-diego', byName: null, at: '2026-09-21T16:10:00.000Z' },
    })
    expect(h.writes[0]).toEqual({
      editing_started_by: 'ed-diego',
      editing_started_at: '2026-09-21T16:10:00.000Z',
    })
    expect(h.filters).toContainEqual(['id', 'idea'])
    expect(h.ors.some((expr) => /editing_started_by\.is\.null/.test(expr) && /editing_started_by\.eq\.ed-diego/.test(expr))).toBe(true)
  })

  it('conflicto si otra persona ya lo tiene: no pisa el write vacío', async () => {
    h.claimed = []
    h.holder = { id: 'idea', editing_started_by: 'ed-maria', editing_started_at: '2026-09-21T15:00:00.000Z' }
    const result = await claimPipelineEdit('idea')
    expect(result).toMatchObject({
      error: 'Este video ya lo está editando María R.',
      claim: { byId: 'ed-maria', byName: 'María R.', at: '2026-09-21T15:00:00.000Z' },
    })
    expect('ok' in result && result.ok).toBeFalsy()
  })

  it('no escribe sin pipeline.claim', async () => {
    h.denied = true
    await expect(claimPipelineEdit('idea')).resolves.toMatchObject({ error: expect.stringMatching(/permiso|denegado/i) })
    expect(h.writes).toHaveLength(0)
  })

  it('no avisa por Slack ni cambia assignment', async () => {
    await claimPipelineEdit('idea')
    expect(h.writes[0]).not.toHaveProperty('assigned_to_id')
    expect(JSON.stringify(h.writes)).not.toMatch(/slack/i)
  })
})

describe('releasePipelineEdit', () => {
  it('el dueño suelta el claim', async () => {
    h.idea = { id: 'idea', editing_started_by: 'ed-diego', editing_started_at: '2026-09-21T15:00:00.000Z' }
    h.claimed = [{ id: 'idea', editing_started_by: null, editing_started_at: null }]
    const result = await releasePipelineEdit('idea')
    expect(result).toEqual({ ok: true })
    expect(h.writes[0]).toEqual({ editing_started_by: null, editing_started_at: null })
    expect(h.filters).toContainEqual(['editing_started_by', 'ed-diego'])
  })

  it('otro editor no puede soltar; un admin con planning.assign sí', async () => {
    h.userId = 'ed-diego'
    h.idea = { id: 'idea', editing_started_by: 'ed-maria', editing_started_at: '2026-09-21T15:00:00.000Z' }
    h.claimed = []
    await expect(releasePipelineEdit('idea')).resolves.toMatchObject({ error: expect.stringMatching(/soltar|reclam/i) })

    h.canAssign = true
    h.claimed = [{ id: 'idea' }]
    h.writes = []
    h.filters = []
    await expect(releasePipelineEdit('idea')).resolves.toEqual({ ok: true })
    expect(h.writes[0]).toEqual({ editing_started_by: null, editing_started_at: null })
    expect(h.filters).not.toContainEqual(['editing_started_by', 'ed-diego'])
  })
})
