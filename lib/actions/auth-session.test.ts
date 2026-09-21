import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.fn()
const cookieDelete = vi.fn()
const signInWithPassword = vi.fn(
  async (_d: unknown): Promise<{ error: { message: string } | null }> => ({ error: null })
)
const supabaseSignOut = vi.fn(async () => ({ error: null }))
const createClient = vi.fn(
  async (_opts?: { sessionOnly?: boolean }) => ({
    auth: {
      signInWithPassword: (d: unknown) => signInWithPassword(d),
      signOut: () => supabaseSignOut(),
    },
  })
)
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, get: () => undefined, getAll: () => [] }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: (opts?: { sessionOnly?: boolean }) => createClient(opts),
}))

import { signIn, signOut } from './auth'

function form(entries: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  cookieSet.mockReset()
  cookieDelete.mockReset()
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
  supabaseSignOut.mockReset().mockResolvedValue({ error: null })
  createClient.mockClear()
  redirectMock.mockClear()
})

describe('signIn — persistencia de sesión', () => {
  it('siempre persiste: borra el marcador y no crea cookies de sesión', async () => {
    await expect(
      signIn(form({ email: 'a@b.com', password: 'x', remember: '1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/pipeline')
    expect(createClient).toHaveBeenCalled()
    expect(createClient.mock.calls[0]?.[0]?.sessionOnly).not.toBe(true)
    expect(cookieDelete).toHaveBeenCalledWith('nm_session_only')
    expect(cookieSet).not.toHaveBeenCalledWith('nm_session_only', expect.anything(), expect.anything())
  })

  it('persiste aunque el form no mande remember (no hay opt-out)', async () => {
    await expect(signIn(form({ email: 'a@b.com', password: 'x' }))).rejects.toThrow(
      'NEXT_REDIRECT:/pipeline'
    )
    expect(createClient).toHaveBeenCalled()
    expect(createClient.mock.calls[0]?.[0]?.sessionOnly).not.toBe(true)
    expect(cookieDelete).toHaveBeenCalledWith('nm_session_only')
    expect(cookieSet).not.toHaveBeenCalledWith('nm_session_only', expect.anything(), expect.anything())
  })

  it('si las credenciales fallan devuelve el error y no toca el marcador', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    const result = await signIn(form({ email: 'a@b.com', password: 'mala' }))
    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(cookieSet).not.toHaveBeenCalled()
    expect(cookieDelete).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('cierra la sesión de Supabase, borra el marcador y manda a /login', async () => {
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(supabaseSignOut).toHaveBeenCalledTimes(1)
    expect(cookieDelete).toHaveBeenCalledWith('nm_session_only')
  })
})
