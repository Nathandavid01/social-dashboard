import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieDelete = vi.fn()
const exchangeCodeForSession = vi.fn(
  async (_code: string): Promise<{ error: { message: string } | null }> => ({ error: null })
)

vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: cookieDelete, set: vi.fn(), get: () => undefined, getAll: () => [] }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: (code: string) => exchangeCodeForSession(code) },
  }),
}))

import { GET } from './route'

beforeEach(() => {
  cookieDelete.mockReset()
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
})

describe('GET /auth/callback', () => {
  it('intercambia el código, limpia el marcador de sesión temporal y manda a /pipeline', async () => {
    const res = await GET(new Request('http://localhost:3020/auth/callback?code=abc123'))
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    // Google login is always persistent — a stale session-only marker from a
    // previous password login must not downgrade it.
    expect(cookieDelete).toHaveBeenCalledWith('nm_session_only')
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.headers.get('location')).toBe('http://localhost:3020/pipeline')
  })

  it('si Google devuelve error, redirige a /login con el mensaje', async () => {
    const res = await GET(
      new Request(
        'http://localhost:3020/auth/callback?error=access_denied&error_description=User%20denied'
      )
    )
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    const location = res.headers.get('location')!
    expect(location.startsWith('http://localhost:3020/login?oauth_error=')).toBe(true)
    expect(decodeURIComponent(location)).toContain('User denied')
  })

  it('sin código redirige a /login con error genérico', async () => {
    const res = await GET(new Request('http://localhost:3020/auth/callback'))
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('/login?oauth_error=')
  })

  it('si el intercambio falla redirige a /login con el mensaje del error', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: { message: 'flow state expired' } })
    const res = await GET(new Request('http://localhost:3020/auth/callback?code=abc123'))
    const location = res.headers.get('location')!
    expect(location).toContain('/login?oauth_error=')
    expect(decodeURIComponent(location)).toContain('flow state expired')
  })
})
