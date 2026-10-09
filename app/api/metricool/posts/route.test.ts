import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
const auth = vi.hoisted(() => ({ allowed: true, sharedBlog: false, clientFilters: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ currentUserHas: async () => auth.allowed }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ select: () => {
  let rowLimit: number | undefined
  const query = {
    eq: (...args: unknown[]) => { auth.clientFilters(...args); return query },
    order: () => query,
    limit: (count: number) => { rowLimit = count; return query },
    maybeSingle: async () => auth.sharedBlog && rowLimit !== 1 ? { data: null, error: { code: 'PGRST116' } } : { data: { id: 'c', name: 'Client', metricool_blog_id: '1' } },
    single: async () => auth.sharedBlog ? { data: null, error: { code: 'PGRST116' } } : { data: { id: 'c', name: 'Client', metricool_blog_id: '1' } },
    not: () => ({ eq: async () => ({ data: [{ id: 'c', name: 'Client', metricool_blog_id: '1' }, { id: 'd', name: 'Other', metricool_blog_id: '2' }] }) }),
  }
  return query
} }) }) }))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); auth.allowed = true; auth.sharedBlog = false; vi.clearAllMocks() })
describe('calendar posts endpoint', () => {
  it('keeps shared-blog filtering available and resolves an active client', async () => {
    auth.sharedBlog = true
    vi.stubEnv('METRICOOL_TOKEN', 'test'); vi.stubEnv('METRICOOL_USER_ID', 'test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 1, draft: false, providers: [], publicationDate: { dateTime: '2026-10-10T10:00:00' } }] }) }))
    const response = await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))
    expect(response.status).toBe(200)
    expect((await response.json()).posts[0]).toMatchObject({ clientId: 'c', clientName: 'Client', blogId: '1' })
    expect(auth.clientFilters).toHaveBeenCalledWith('status', 'active')
  })
  it('denies callers without metricool.read', async () => {
    auth.allowed = false
    expect((await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))).status).toBe(403)
  })
  it('verifies directly without cached responses and returns evidence for each network', async () => {
    vi.stubEnv('METRICOOL_TOKEN', 'test'); vi.stubEnv('METRICOOL_USER_ID', 'test')
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ([{ id: 1, draft: false, providers: [{ network: 'instagram', status: 'PUBLISHED', publicUrl: 'https://www.instagram.com/p/test/' }, { network: 'facebook', status: 'ERROR', detailedStatus: 'Permission expired' }], publicationDate: { dateTime: '2026-10-10T10:00:00' } }]) })
    vi.stubGlobal('fetch', fetcher)
    const response = await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))
    const data = await response.json()
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    expect(data).toMatchObject({ complete: true, checkedAt: expect.any(String) })
    expect(data.posts[0].providers[0]).toMatchObject({ status: 'PUBLISHED', publicUrl: 'https://www.instagram.com/p/test/' })
    expect(data.posts[0].providers[1]).toMatchObject({ status: 'ERROR', detailedStatus: 'Permission expired' })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('reports a failed account as incomplete rather than an empty verified calendar', async () => {
    vi.stubEnv('METRICOOL_TOKEN', 'test'); vi.stubEnv('METRICOOL_USER_ID', 'test')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async url => String(url).includes('blogId=2') ? { ok: false, status: 429 } : { ok: true, json: async () => ({ data: [] }) }))
    const data = await (await GET(new NextRequest('http://localhost/api/metricool/posts?all=true'))).json()
    expect(data).toMatchObject({ complete: false, failedClients: [{ id: 'd', name: 'Other' }] })
  })
  it('returns an error when Metricool is unavailable or unconfigured', async () => {
    vi.stubEnv('METRICOOL_TOKEN', ''); vi.stubEnv('METRICOOL_USER_ID', '')
    expect((await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))).status).toBe(503)
    vi.stubEnv('METRICOOL_TOKEN', 'test'); vi.stubEnv('METRICOOL_USER_ID', 'test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    expect((await GET(new NextRequest('http://localhost/api/metricool/posts?blogId=1'))).status).toBe(502)
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

it('resolves a per-client account from the database even if a different blog is supplied',async()=>{
 vi.stubEnv('METRICOOL_TOKEN','test');vi.stubEnv('METRICOOL_USER_ID','test')
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});vi.stubGlobal('fetch',fetcher)
 const res=await GET(new NextRequest('http://localhost/api/metricool/posts?clientId=c&blogId=foreign'))
 expect(res.status).toBe(200)
 expect(auth.clientFilters).toHaveBeenCalledWith('id','c')
 expect(fetcher.mock.calls[0][0]).toContain('blogId=1')
 expect(fetcher.mock.calls[0][0]).not.toContain('foreign')
})

it('normalizes media URLs returned as strings so uploaded images have calendar previews',async()=>{
 vi.stubEnv('METRICOOL_TOKEN','test');vi.stubEnv('METRICOOL_USER_ID','test')
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[{id:1,draft:true,providers:[],publicationDate:{dateTime:'2099-10-20T10:30:00'},media:['https://media.example/photo.jpg']}]})}))
 const data=await (await GET(new NextRequest('http://localhost/api/metricool/posts?clientId=c&includeDrafts=true'))).json()
 expect(data.posts[0].media).toEqual([{url:'https://media.example/photo.jpg'}])
})
