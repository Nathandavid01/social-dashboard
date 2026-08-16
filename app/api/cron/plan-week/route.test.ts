import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Any Supabase call from this route must NOT happen without a valid secret.
const fromSpy = vi.fn(() => {
  throw new Error('no debería llamarse a Supabase sin autorización')
})
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: fromSpy })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { GET } from './route'

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/plan-week', { headers })
}

beforeEach(() => {
  fromSpy.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/plan-week — mismo gate de CRON_SECRET', () => {
  it('sin cabecera → 401, no toca Supabase', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('x-vercel-cron solo, sin Bearer → 401', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req({ 'x-vercel-cron': '1' }))
    expect(res.status).toBe(401)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('sin CRON_SECRET en el entorno → 503, no ejecuta', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(req({ Authorization: 'Bearer x' }))
    expect(res.status).toBe(503)
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
