import { describe, expect, it, vi } from 'vitest'
import { runPoolSmoke } from './smoke-pool.mjs'

describe('runPoolSmoke', () => {
  it('omite (exit 0) si no hay URL — no exige Supabase ni secretos', async () => {
    const fetchImpl = vi.fn()
    const result = await runPoolSmoke({ env: {}, fetchImpl })
    expect(result.skipped).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('falla si /pool responde 500', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/health/pool')) {
        return new Response(JSON.stringify({ ok: true, route: '/pool', supabaseConfigured: true }), {
          status: 200,
        })
      }
      return new Response('Internal Server Error', { status: 500 })
    })
    const result = await runPoolSmoke({
      env: { SMOKE_BASE_URL: 'https://preview.example' },
      fetchImpl,
    })
    expect(result.skipped).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.failedPath).toBe('/pool')
  })

  it('pasa con health 200 y /pool 307 (redirect a login)', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/health/pool')) {
        return new Response(JSON.stringify({ ok: true, route: '/pool', supabaseConfigured: false }), {
          status: 200,
        })
      }
      return new Response(null, { status: 307, headers: { Location: '/login' } })
    })
    const result = await runPoolSmoke({
      env: { SMOKE_BASE_URL: 'https://preview.example' },
      fetchImpl,
    })
    expect(result.exitCode).toBe(0)
    expect(result.skipped).toBe(false)
  })
})
