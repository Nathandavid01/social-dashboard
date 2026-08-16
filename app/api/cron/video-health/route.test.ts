import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fromSpy = vi.fn(() => {
  throw new Error('no debería llamarse a Supabase sin autorización')
})
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: fromSpy })),
}))
vi.mock('@/lib/integrations/r2', () => ({ r2PublicUrl: vi.fn(() => 'https://x/y') }))
vi.mock('@/lib/integrations/video-health', () => ({ checkVideoPlayable: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/utils/video-analysis-sweep', () => ({ staleAnalysisCandidates: vi.fn(() => []) }))

import type { NextRequest } from 'next/server'
import { GET } from './route'

function req(headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost/api/cron/video-health', { headers }) as unknown as NextRequest
}

beforeEach(() => {
  fromSpy.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/video-health — mismo gate de CRON_SECRET', () => {
  it('sin cabecera → 401, no consulta Supabase', async () => {
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
