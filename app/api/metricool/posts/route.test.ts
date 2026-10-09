import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/lib/auth/server', () => ({ currentUserHas: async () => auth.allowed }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'c', name: 'Client' } }) }) }) }) }) }))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); auth.allowed = true })
describe('calendar posts endpoint', () => {
  it('denies callers without metricool.read', async () => {
    auth.allowed = false
    expect((await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))).status).toBe(403)
  })
  it('includes drafts only on request and passes real platform statuses', async () => {
    vi.stubEnv('METRICOOL_TOKEN', 'test'); vi.stubEnv('METRICOOL_USER_ID', 'test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 1, draft: true, providers: [{ network: 'instagram', status: 'PENDING' }], publicationDate: { dateTime: '2026-10-10T10:00:00', timezone: 'America/Puerto_Rico' } }] }) }))
    const url = 'http://localhost/api/metricool/posts?blogId=1'
    expect((await (await GET(new NextRequest(url))).json()).posts).toHaveLength(0)
    const response = await (await GET(new NextRequest(`${url}&includeDrafts=true`))).json()
    expect(response.posts[0]).toMatchObject({ draft: true, providerStatuses: ['PENDING'] })
  })
})
