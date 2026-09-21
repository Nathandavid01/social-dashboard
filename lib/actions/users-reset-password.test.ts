import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentRole = vi.fn(async () => 'owner' as string | null)
const getViewAsEditor = vi.fn(async () => null as { id: string } | null)
vi.mock('@/lib/auth/server', () => ({
  assertOwner: vi.fn(async () => {}),
  getCurrentRole: () => getCurrentRole(),
  getViewAsEditor: () => getViewAsEditor(),
}))

const updateUserById = vi.fn<
  (id: string, attrs: { password: string }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
>(async () => ({ data: { user: { id: 'u1' } }, error: null }))
const maybeSingle = vi.fn<
  () => Promise<{ data: { id: string; role: string } | null; error: { message: string } | null }>
>(async () => ({ data: { id: 'u1', role: 'editor' }, error: null }))
let adminClient: unknown = {
  auth: { admin: { updateUserById } },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle }),
    }),
  }),
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminClient,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { resetUserPassword } from './users'

const PASSWORD = 'Nmtemporal9!'

beforeEach(() => {
  getCurrentRole.mockReset().mockResolvedValue('owner')
  getViewAsEditor.mockReset().mockResolvedValue(null)
  updateUserById.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  maybeSingle.mockReset().mockResolvedValue({ data: { id: 'u1', role: 'editor' }, error: null })
  adminClient = {
    auth: { admin: { updateUserById } },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }
})

describe('resetUserPassword', () => {
  it('lets an owner assign a password and close the other sessions', async () => {
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res).toEqual({ ok: true })
    expect(updateUserById).toHaveBeenCalledWith('u1', { password: PASSWORD })
  })

  it('lets a supervisor assign a password to an editor', async () => {
    getCurrentRole.mockResolvedValue('supervisor')
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.ok).toBe(true)
    expect(updateUserById).toHaveBeenCalledTimes(1)
  })

  it('refuses a supervisor assigning an owner or supervisor password', async () => {
    getCurrentRole.mockResolvedValue('supervisor')
    maybeSingle.mockResolvedValue({ data: { id: 'u1', role: 'owner' }, error: null })
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.error).toMatch(/Owner/)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('refuses an editor', async () => {
    getCurrentRole.mockResolvedValue('editor')
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.error).toBeTruthy()
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('refuses assigning your own password', async () => {
    const res = await resetUserPassword('me', PASSWORD)
    expect(res.error).toMatch(/Seguridad/)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('refuses while viewing the dashboard as someone else', async () => {
    getViewAsEditor.mockResolvedValue({ id: 'other' })
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.error).toMatch(/ver como/)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('rejects a short password before touching Auth', async () => {
    const res = await resetUserPassword('u1', 'short')
    expect(res.error).toMatch(/8/)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('reports a missing person and does not invent a password change', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await resetUserPassword('missing', PASSWORD)
    expect(res.error).toBeTruthy()
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('returns the Auth error and does not pretend the password changed', async () => {
    updateUserById.mockResolvedValue({ data: { user: null }, error: { message: 'weak' } })
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.error).toBe('weak')
    expect(res.ok).toBeUndefined()
  })

  it('says when the service role key is missing', async () => {
    adminClient = null
    const res = await resetUserPassword('u1', PASSWORD)
    expect(res.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
