import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const runMetricoolPublishedSync = vi.fn(async () => ({ moved: 1 }))
vi.mock('@/lib/metricool/sync', () => ({
  runMetricoolPublishedSync: (...args: unknown[]) => runMetricoolPublishedSync(...args),
}))

const getAgencyReach = vi.fn(async () => ({ total: 1 }))
vi.mock('@/lib/actions/agency-reach', () => ({
  getAgencyReach: (...args: unknown[]) => getAgencyReach(...args),
}))

import { GET } from './route'

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/metricool-sync', { headers })
}

beforeEach(() => {
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
})
