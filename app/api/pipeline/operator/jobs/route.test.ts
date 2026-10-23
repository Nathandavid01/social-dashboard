import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminSpy = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminSpy() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/pipeline/operator-service', () => ({
  listOperatorJobs: vi.fn(async () => ({ status: 200, body: { count: 0, items: [] } })),
  submitPipelineVideo: vi.fn(async () => ({ status: 200, body: { item: { id: 'idea-1' } } })),
}))

import { submitPipelineVideo } from '@/lib/pipeline/operator-service'
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

  it('el cuerpo del contrato viejo no llama al servicio', async () => {
    vi.stubEnv('PIPELINE_OPERATOR_TOKEN', 'token-real')
    adminSpy.mockReturnValue({})
    const res = await POST(req('http://localhost/api/pipeline/operator/jobs', {
      method: 'POST',
      headers: { authorization: 'Bearer token-real', 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: '11111111-1111-4111-8111-111111111111', title: 'Corte' }),
    }))
    expect(res.status).toBe(400)
    expect(submitPipelineVideo).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toMatch(/ideaId/)
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
