import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Fail-closed auth for the cron: ONLY `Authorization: Bearer $CRON_SECRET`
 * runs this. No `x-vercel-cron` header fallback (that header is
 * caller-supplied and forgeable — the exact gap an audit exploited in
 * production on the other crons). Missing CRON_SECRET must refuse to run,
 * not silently trust an unforgeable-sounding header.
 */

const r2Send = vi.fn()
const entregasSend = vi.fn()

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: r2Send })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: vi.fn(() => ({ send: entregasSend })),
  entregasR2Bucket: vi.fn(() => 'nmedia-entregas'),
  isEntregasR2Configured: vi.fn(() => true),
}))

const adminDelete = vi.fn(async () => ({ error: null, count: 0 }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        lt: adminDelete,
      })),
    })),
  })),
}))

import { GET } from './route'

const ORIGINAL_ENV = { ...process.env }

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/multipart-sweep', { headers }) as never as Parameters<typeof GET>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  r2Send.mockResolvedValue({ Uploads: [] })
  entregasSend.mockResolvedValue({ Uploads: [] })
  adminDelete.mockResolvedValue({ error: null, count: 0 })
  process.env.CRON_SECRET = 'top-secret'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('GET /api/cron/multipart-sweep', () => {
  it('refuses with no Authorization header at all — 401, nothing runs', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(r2Send).not.toHaveBeenCalled()
    expect(entregasSend).not.toHaveBeenCalled()
    expect(adminDelete).not.toHaveBeenCalled()
  })

  it('refuses an x-vercel-cron header alone — that fallback is gone, forging it must not work', async () => {
    const res = await GET(req({ 'x-vercel-cron': '1' }))
    expect(res.status).toBe(401)
    expect(r2Send).not.toHaveBeenCalled()
  })

  it('refuses a wrong Bearer token', async () => {
    const res = await GET(req({ authorization: 'Bearer nope' }))
    expect(res.status).toBe(401)
    expect(r2Send).not.toHaveBeenCalled()
  })

  it('runs the sweep with the correct Bearer token', async () => {
    const res = await GET(req({ authorization: 'Bearer top-secret' }))
    expect(res.status).toBe(200)
    expect(r2Send).toHaveBeenCalled()
    expect(entregasSend).toHaveBeenCalled()
    expect(adminDelete).toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is not set — 503, nothing runs even with a Bearer header', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req({ authorization: 'Bearer anything' }))
    expect(res.status).toBe(503)
    expect(r2Send).not.toHaveBeenCalled()
    expect(entregasSend).not.toHaveBeenCalled()
    expect(adminDelete).not.toHaveBeenCalled()
  })
})
