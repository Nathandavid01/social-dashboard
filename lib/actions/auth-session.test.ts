import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.fn()
const cookieDelete = vi.fn()
const signInWithPassword = vi.fn(
  async (_d: unknown): Promise<{ error: { message: string } | null }> => ({ error: null })
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
  createClient: async () => ({
    auth: { signInWithPassword: (d: unknown) => signInWithPassword(d) },
  }),
}))

import { signIn } from './auth'

function form(entries: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  cookieSet.mockReset()
  cookieDelete.mockReset()
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
  redirectMock.mockClear()
})

describe('signIn — persistencia de sesión', () => {
  it('con "mantener sesión" marcado borra el marcador de sesión temporal', async () => {
    await expect(
      signIn(form({ email: 'a@b.com', password: 'x', remember: '1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/pipeline')
    expect(cookieDelete).toHaveBeenCalledWith('nm_session_only')
    expect(cookieSet).not.toHaveBeenCalledWith('nm_session_only', expect.anything(), expect.anything())
  })

  it('sin "mantener sesión" pone el marcador como cookie de sesión (sin maxAge)', async () => {
    await expect(signIn(form({ email: 'a@b.com', password: 'x' }))).rejects.toThrow(
      'NEXT_REDIRECT:/pipeline'
    )
    expect(cookieSet).toHaveBeenCalledWith(
      'nm_session_only',
      '1',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    )
    const options = cookieSet.mock.calls.find((c) => c[0] === 'nm_session_only')?.[2] as
      | Record<string, unknown>
      | undefined
    expect(options).toBeDefined()
    expect(options).not.toHaveProperty('maxAge')
    expect(options).not.toHaveProperty('expires')
  })

  it('si las credenciales fallan devuelve el error y no toca el marcador', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    const result = await signIn(form({ email: 'a@b.com', password: 'mala' }))
    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(cookieSet).not.toHaveBeenCalled()
    expect(cookieDelete).not.toHaveBeenCalled()
  })
})
