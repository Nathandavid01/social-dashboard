import { describe, it, expect, afterEach, vi } from 'vitest'
import { cronAuthDenial } from './cron'

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/whatever', { headers })
}

describe('cronAuthDenial — gate para todas las rutas /api/cron/*', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sin CRON_SECRET en el entorno → falla cerrado con 503, sin importar la cabecera', () => {
    vi.stubEnv('CRON_SECRET', '')
    const denial = cronAuthDenial(req({ Authorization: 'Bearer lo-que-sea' }))
    expect(denial).not.toBeNull()
    expect(denial?.status).toBe(503)
  })

  it('sin cabecera Authorization → 401', () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const denial = cronAuthDenial(req())
    expect(denial).not.toBeNull()
    expect(denial?.status).toBe(401)
  })

  it('regresión de la auditoría: x-vercel-cron sin Bearer YA NO autoriza → 401', () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const denial = cronAuthDenial(req({ 'x-vercel-cron': '1' }))
    expect(denial).not.toBeNull()
    expect(denial?.status).toBe(401)
  })

  it('Authorization con secreto incorrecto → 401', () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const denial = cronAuthDenial(req({ Authorization: 'Bearer secreto-falso' }))
    expect(denial).not.toBeNull()
    expect(denial?.status).toBe(401)
  })

  it('Authorization: Bearer <CRON_SECRET> correcto → autoriza (null)', () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const denial = cronAuthDenial(req({ Authorization: 'Bearer secreto-real' }))
    expect(denial).toBeNull()
  })
})
