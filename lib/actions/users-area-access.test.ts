/**
 * setUserAreaAccess persistence + the silent-RLS-failure guard.
 * Regression: prod was missing the "owner update role" RLS policy, so updating
 * another user's profile returned 0 rows with NO error — the save looked
 * successful but nothing persisted. The action must now treat 0 updated rows as
 * an error instead of reporting success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ assertOwner: () => assertOwner() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Configurable update result: { data, error } returned by .select('id').
let updateResult: { data: unknown[] | null; error: { message: string } | null } = { data: [{ id: 'u1' }], error: null }
let lastUpdatePayload: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      update: (p: Record<string, unknown>) => {
        lastUpdatePayload = p
        return { eq: () => ({ select: async () => updateResult }) }
      },
    }),
  }),
}))

import { setUserAreaAccess } from './users'

beforeEach(() => {
  assertOwner.mockReset().mockResolvedValue(undefined)
  updateResult = { data: [{ id: 'u1' }], error: null }
  lastUpdatePayload = null
})

describe('setUserAreaAccess', () => {
  it('saves the chosen areas when the update affects a row', async () => {
    const res = await setUserAreaAccess('u1', ['/clients', '/team'])
    expect(res).toEqual({ ok: true })
    expect(lastUpdatePayload?.area_access).toEqual(['/clients', '/team'])
  })

  it('drops unknown hrefs and de-dupes before saving', async () => {
    await setUserAreaAccess('u1', ['/clients', '/clients', '/not-a-real-area'])
    expect(lastUpdatePayload?.area_access).toEqual(['/clients'])
  })

  it('stores null when clearing the restriction', async () => {
    await setUserAreaAccess('u1', null)
    expect(lastUpdatePayload?.area_access).toBeNull()
  })

  it('reports an error when RLS silently filters the row (0 updated)', async () => {
    updateResult = { data: [], error: null }
    const res = await setUserAreaAccess('u1', ['/clients'])
    expect(res.ok).toBeUndefined()
    expect(res.error).toMatch(/no se pudo guardar/i)
  })

  it('refuses when the caller is not an owner', async () => {
    assertOwner.mockRejectedValueOnce(new Error('Esta acción requiere rol de Owner.'))
    const res = await setUserAreaAccess('u1', ['/clients'])
    expect(res.error).toMatch(/owner/i)
  })
})
