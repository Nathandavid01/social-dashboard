import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/health/pool', () => {
  it('sin Supabase no es 500: responde 200 y supabaseConfigured=false', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.route).toBe('/pool')
    expect(body.supabaseConfigured).toBe(false)
  })

  it('con env público marca supabaseConfigured=true', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supabaseConfigured).toBe(true)
  })
})
