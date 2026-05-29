import { describe, it, expect, vi, beforeEach } from 'vitest'

const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ assertOwner: () => assertOwner() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const AUTH_ID = 'me'
let updatePayload: Record<string, unknown> | null = null
let targetRow: { id: string; status: string; role: string } = { id: 'u1', status: 'active', role: 'editor' }
let ownerCount = 2

function makeSupabase() {
  // One builder serves both the .single() read and the awaited count query.
  const builder: any = {
    eq: () => builder,
    single: async () => ({ data: targetRow, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ count: ownerCount, error: null }),
  }
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: AUTH_ID } } })) },
    from: vi.fn(() => ({
      update: (p: Record<string, unknown>) => {
        updatePayload = p
        return { eq: async () => ({ error: null }) }
      },
      select: () => builder,
    })),
  }
}

let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { updateUserProfile, setUserStatus } from './users'

beforeEach(() => {
  updatePayload = null
  ownerCount = 2
  targetRow = { id: 'u1', status: 'active', role: 'editor' }
  assertOwner.mockReset().mockResolvedValue(undefined)
  supa = makeSupabase()
})

describe('updateUserProfile', () => {
  it('rejects an empty name and writes nothing', async () => {
    const res = await updateUserProfile('u1', { full_name: '   ', title: 'x' })
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('trims and saves name + title', async () => {
    const res = await updateUserProfile('u1', { full_name: ' Ana ', title: ' COO ' })
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ full_name: 'Ana', title: 'COO' })
  })

  it('stores null when the title is blank', async () => {
    await updateUserProfile('u1', { full_name: 'Ana', title: '  ' })
    expect(updatePayload).toMatchObject({ title: null })
  })

  it('is owner-gated', async () => {
    assertOwner.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await updateUserProfile('u1', { full_name: 'Ana' })
    expect(res.error).toBe('No autorizado')
    expect(updatePayload).toBeNull()
  })
})

describe('setUserStatus', () => {
  it('deactivates another active (non-owner) user', async () => {
    const res = await setUserStatus('u1', 'inactive')
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ status: 'inactive' })
  })

  it('reactivates a user', async () => {
    const res = await setUserStatus('u1', 'active')
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ status: 'active' })
  })

  it('blocks self-deactivation', async () => {
    const res = await setUserStatus(AUTH_ID, 'inactive')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('blocks deactivating the last active owner', async () => {
    targetRow = { id: 'u1', status: 'active', role: 'owner' }
    ownerCount = 1
    const res = await setUserStatus('u1', 'inactive')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('allows deactivating an owner when others remain', async () => {
    targetRow = { id: 'u1', status: 'active', role: 'owner' }
    ownerCount = 2
    const res = await setUserStatus('u1', 'inactive')
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ status: 'inactive' })
  })

  it('is owner-gated', async () => {
    assertOwner.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await setUserStatus('u1', 'inactive')
    expect(res.error).toBe('No autorizado')
    expect(updatePayload).toBeNull()
  })
})
