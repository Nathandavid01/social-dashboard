import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { APP_VERSION } from '@/lib/version'

const readFail = vi.hoisted(() => ({ next: false }))
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  const readFile = (async (...args: Parameters<typeof actual.readFile>) => {
    if (readFail.next) {
      readFail.next = false
      throw new Error('ENOENT')
    }
    return actual.readFile(...args)
  }) as typeof actual.readFile
  return { ...actual, default: { ...actual, readFile }, readFile }
})

const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

const call = (qs: string) => GET(new Request(`http://localhost/api/changelog${qs}`))

describe('GET /api/changelog', () => {
  it('sin sesión responde 401, igual que /changelog no se ve sin login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect((await call('')).status).toBe(401)
  })

  it('si no puede leer CHANGELOG.md responde 500, no una lista vacía (que el cliente tomaría como «al día»)', async () => {
    readFail.next = true
    expect((await call('')).status).toBe(500)
  })

  it('sin since devuelve solo la novedad actual', async () => {
    const res = await call('')
    const { entries } = await res.json()
    expect(entries).toHaveLength(1)
    expect(entries[0].version).toBe(APP_VERSION)
  })

  it('con since igual a la versión actual no devuelve nada', async () => {
    const { entries } = await (await call(`?since=${APP_VERSION}`)).json()
    expect(entries).toEqual([])
  })

  it('con since viejo devuelve varias, la más nueva primero', async () => {
    const { entries } = await (await call('?since=5.130')).json()
    expect(entries.length).toBeGreaterThan(1)
    expect(entries[0].version).toBe(APP_VERSION)
  })
})
