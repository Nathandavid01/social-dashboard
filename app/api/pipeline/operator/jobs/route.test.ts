import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminSpy = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminSpy() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/pipeline/operator-service', () => ({
  listOperatorJobs: vi.fn(async () => ({ status: 200, body: { count: 0, jobs: [] } })),
  startOperatorJob: vi.fn(async () => ({ status: 201, body: { job: { id: 'job-1' } } })),
}))

import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init)
}

beforeEach(() => {
  adminSpy.mockReset()
  vi.unstubAllEnvs()
})

describe('operador del pipeline — gate', () => {
  it('sin PIPELINE_OPERATOR_TOKEN → 503 y no abre la base', async () => {
    vi.stubEnv('PIPELINE_OPERATOR_TOKEN', '')
    const res = await GET(req('http://localhost/api/pipeline/operator/jobs', { headers: { authorization: 'Bearer x' } }))
    expect(res.status).toBe(503)
    expect(adminSpy).not.toHaveBeenCalled()
  })

  it('sin Bearer → 401 y no abre la base', async () => {
    vi.stubEnv('PIPELINE_OPERATOR_TOKEN', 'token-real')
    const res = await POST(req('http://localhost/api/pipeline/operator/jobs', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect(adminSpy).not.toHaveBeenCalled()
  })

  it('Bearer incorrecto → 401', async () => {
    vi.stubEnv('PIPELINE_OPERATOR_TOKEN', 'token-real')
    const res = await GET(req('http://localhost/api/pipeline/operator/jobs', { headers: { authorization: 'Bearer otro' } }))
    expect(res.status).toBe(401)
    expect(adminSpy).not.toHaveBeenCalled()
  })

  it('sin service role → 503 después de aceptar el token', async () => {
    vi.stubEnv('PIPELINE_OPERATOR_TOKEN', 'token-real')
    adminSpy.mockReturnValue(null)
    const res = await GET(req('http://localhost/api/pipeline/operator/jobs', { headers: { authorization: 'Bearer token-real' } }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})
