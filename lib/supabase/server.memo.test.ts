import { describe, it, expect, vi, beforeEach } from 'vitest'

let currentStore: { getAll: () => unknown[]; set: () => void } = { getAll: () => [], set: () => {} }
vi.mock('next/headers', () => ({ cookies: async () => currentStore }))

const getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null }))
const signOut = vi.fn(async () => ({ error: null }))
const signInWithPassword = vi.fn(async () => ({ error: null }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser, signOut, signInWithPassword },
    from: vi.fn(),
  }),
}))

import { createClient } from './server'

beforeEach(() => {
  currentStore = { getAll: () => [], set: () => {} }
  getUser.mockClear()
  signOut.mockClear()
})

describe('createClient — auth.getUser memoizado por request', () => {
  it('varios clientes en el mismo request comparten UNA llamada a getUser', async () => {
    const a = await createClient()
    const b = await createClient()
    const [ra, rb] = await Promise.all([a.auth.getUser(), b.auth.getUser(), a.auth.getUser()])
    expect(ra.data.user?.id).toBe('u1')
    expect(rb.data.user?.id).toBe('u1')
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('un request distinto vuelve a validar la sesión', async () => {
    await (await createClient()).auth.getUser()
    currentStore = { getAll: () => [], set: () => {} }
    await (await createClient()).auth.getUser()
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it('tras signOut el siguiente getUser NO usa el valor memoizado', async () => {
    const c = await createClient()
    await c.auth.getUser()
    await c.auth.signOut()
    await c.auth.getUser()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it('tras signInWithPassword (cualquier método que no sea lectura) el siguiente getUser NO usa el valor memoizado', async () => {
    const c = await createClient()
    await c.auth.getUser()
    await c.auth.signInWithPassword({ email: 'a@b.c', password: 'x' } as never)
    await c.auth.getUser()
    expect(getUser).toHaveBeenCalledTimes(2)
  })
})
