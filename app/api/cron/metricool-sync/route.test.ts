import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runMetricoolPublishedSync = vi.fn(async () => ({ moved: 1 }))
vi.mock('@/lib/metricool/sync', () => ({
  runMetricoolPublishedSync: () => runMetricoolPublishedSync(),
}))

const runReciboPublishedMatch = vi.fn(async (_options?: { deadline?: number }) => ({ linked: 2 }))
vi.mock('@/lib/recibo/sync-published', () => ({
  runReciboPublishedMatch: (options?: { deadline?: number }) => runReciboPublishedMatch(options),
}))

const getAgencyReach = vi.fn(async () => ({ total: 1 }))
vi.mock('@/lib/actions/agency-reach', () => ({
  getAgencyReach: () => getAgencyReach(),
}))

import type { NextRequest } from 'next/server'
import { GET } from './route'

function req(headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost/api/cron/metricool-sync', { headers }) as unknown as NextRequest
}

beforeEach(() => {
  runReciboPublishedMatch.mockClear()
  runMetricoolPublishedSync.mockClear()
  getAgencyReach.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/metricool-sync — auditoría: el cron ya no acepta a cualquiera', () => {
  it('sin cabecera → 401 y CERO efectos (no sincroniza, no llama Metricool)', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(runMetricoolPublishedSync).not.toHaveBeenCalled()
    expect(runReciboPublishedMatch).not.toHaveBeenCalled()
    expect(getAgencyReach).not.toHaveBeenCalled()
  })

  it('regresión: x-vercel-cron sin Bearer YA NO autoriza → 401, cero efectos', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req({ 'x-vercel-cron': '1' }))
    expect(res.status).toBe(401)
    expect(runMetricoolPublishedSync).not.toHaveBeenCalled()
  })

  it('sin CRON_SECRET en el entorno → 503, NO ejecuta nada (falla cerrado)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(req({ Authorization: 'Bearer lo-que-sea' }))
    expect(res.status).toBe(503)
    expect(runMetricoolPublishedSync).not.toHaveBeenCalled()
    expect(getAgencyReach).not.toHaveBeenCalled()
  })

  it('con Authorization: Bearer <CRON_SECRET> correcto → ejecuta el sync', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    expect(res.status).toBe(200)
    expect(runMetricoolPublishedSync).toHaveBeenCalledTimes(1)
  })

  it('enlaza primero lo publicado a mano desde Recibo, y luego el sync lo pasa a publicada en la misma corrida', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    expect(runReciboPublishedMatch.mock.invocationCallOrder[0]).toBeLessThan(runMetricoolPublishedSync.mock.invocationCallOrder[0])
    expect(await res.json()).toMatchObject({ recibo: { linked: 2 } })
  })

  it('si el cruce de Recibo falla, el sync de siempre corre igual', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    runReciboPublishedMatch.mockRejectedValueOnce(new Error('boom'))
    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    expect(res.status).toBe(200)
    expect(runMetricoolPublishedSync).toHaveBeenCalledTimes(1)
  })
  it('le da al cruce de Recibo un plazo de 20 s: el cron tiene 60 y el sync de siempre va después', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const before = Date.now()
    await GET(req({ Authorization: 'Bearer secreto-real' }))
    const deadline = runReciboPublishedMatch.mock.calls[0][0]?.deadline ?? 0
    expect(deadline - before).toBeGreaterThanOrEqual(20_000)
    expect(deadline - Date.now()).toBeLessThanOrEqual(20_000)
  })
})
