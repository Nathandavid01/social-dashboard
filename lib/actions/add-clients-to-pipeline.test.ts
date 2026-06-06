import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async (_p: string) => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: (p: string) => requirePermission(p) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let inserted: any[]
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: () => ({
      insert: (payload: any) => {
        inserted = inserted.concat(Array.isArray(payload) ? payload : [payload])
        return { then: (resolve: (v: unknown) => unknown) => resolve({ error: null }) }
      },
    }),
  }),
}))

import { addClientsToPipeline } from './add-clients-to-pipeline'

beforeEach(() => {
  inserted = []
  requirePermission.mockReset().mockResolvedValue(undefined)
})

describe('addClientsToPipeline', () => {
  it('creates one starter card per selected client at the idea column', async () => {
    const res = await addClientsToPipeline({ clientIds: ['c1', 'c2', 'c3'] })
    expect(res.created).toBe(3)
    expect(inserted).toHaveLength(3)
    expect(inserted.every((r) => r.status === 'idea')).toBe(true)
    expect(inserted.map((r) => r.client_id).sort()).toEqual(['c1', 'c2', 'c3'])
    expect(inserted[0]).toMatchObject({ created_by: 'user-1' })
    expect(typeof inserted[0].title).toBe('string')
    expect(inserted[0].title.length).toBeGreaterThan(0)
  })

  it('dedupes repeated client ids', async () => {
    const res = await addClientsToPipeline({ clientIds: ['c1', 'c1', 'c2'] })
    expect(res.created).toBe(2)
    expect(inserted.map((r) => r.client_id).sort()).toEqual(['c1', 'c2'])
  })

  it('ignores blanks and errors when nothing valid is selected', async () => {
    const res = await addClientsToPipeline({ clientIds: ['', '   '] })
    expect(res.error).toBeTruthy()
    expect(inserted).toHaveLength(0)
  })

  it('returns an error and writes nothing without permission', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await addClientsToPipeline({ clientIds: ['c1'] })
    expect(res.error).toBeTruthy()
    expect(inserted).toHaveLength(0)
  })
})
