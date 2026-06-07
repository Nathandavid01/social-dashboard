import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchClientStyleExamples } from './metricool-style'

const ENV = { METRICOOL_TOKEN: 'tok', METRICOOL_USER_ID: 'uid', METRICOOL_BLOG_ID: 'default-blog' }

function mockFetchOnce(payload: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => payload })))
}

beforeEach(() => {
  process.env.METRICOOL_TOKEN = ENV.METRICOOL_TOKEN
  process.env.METRICOOL_USER_ID = ENV.METRICOOL_USER_ID
  process.env.METRICOOL_BLOG_ID = ENV.METRICOOL_BLOG_ID
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchClientStyleExamples', () => {
  it('returns [] when Metricool env is not configured', async () => {
    delete process.env.METRICOOL_TOKEN
    const out = await fetchClientStyleExamples('blog-1')
    expect(out).toEqual([])
  })

  it('returns [] when the response is not ok', async () => {
    mockFetchOnce({}, false)
    expect(await fetchClientStyleExamples('blog-1')).toEqual([])
  })

  it('filters out drafts and very short posts, maps provider, caps at 12', async () => {
    const data = [
      { text: 'A published caption that is long enough to keep', providers: [{ network: 'instagram' }] },
      { text: 'short', providers: [{ network: 'tiktok' }] }, // too short
      { text: 'A draft caption that is plenty long but unpublished', providers: [{ network: 'facebook' }], draft: true },
      ...Array.from({ length: 15 }, (_, i) => ({ text: `Caption number ${i} long enough to keep`, providers: [{ network: 'instagram' }] })),
    ]
    mockFetchOnce({ data })
    const out = await fetchClientStyleExamples('blog-1')
    expect(out).toHaveLength(12) // capped
    expect(out[0]).toEqual({ text: 'A published caption that is long enough to keep', provider: 'instagram' })
    expect(out.some((e) => e.text === 'short')).toBe(false)
    expect(out.some((e) => /draft caption/.test(e.text))).toBe(false)
  })

  it('defaults provider to instagram when none is present', async () => {
    mockFetchOnce({ data: [{ text: 'A caption with no provider field at all here' }] })
    const out = await fetchClientStyleExamples('blog-1')
    expect(out[0].provider).toBe('instagram')
  })

  it('returns [] (never throws) when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await fetchClientStyleExamples('blog-1')).toEqual([])
  })

  it('passes the client blogId in the request URL', async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))
    vi.stubGlobal('fetch', spy)
    await fetchClientStyleExamples('client-blog-42')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('blogId=client-blog-42'), expect.anything())
  })
})
