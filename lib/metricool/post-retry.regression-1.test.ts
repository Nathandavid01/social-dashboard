import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraftPost } from './post'

beforeEach(() => {
  vi.stubEnv('METRICOOL_TOKEN', 'test-token')
  vi.stubEnv('METRICOOL_USER_ID', 'test-user')
  vi.stubEnv('METRICOOL_BLOG_ID', 'test-blog')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const send = () => createDraftPost('Caption', 'client', ['instagram'], undefined, '2026-09-10T10:00:00', { autoPublish: true, contentType: 'R' })

describe('Metricool POST retries', () => {
  it.each([401, 403, 408, 429, 500, 502, 503, 504])('never resends a creation request after HTTP %s', async status => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status, text: async () => 'request failed' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 2 } }) })
    vi.stubGlobal('fetch', fetch)
    await expect(send()).rejects.toThrow(`Metricool API error: ${status}`)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([400, 422])('allows one format fallback after explicit validation rejection %s', async status => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status, text: async () => 'bad format' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 2 } }) })
    vi.stubGlobal('fetch', fetch)
    await expect(send()).resolves.toMatchObject({ data: { id: 2 } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('does not retry transport failures with an unknown remote outcome', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Timeout'))
    vi.stubGlobal('fetch', fetch)
    await expect(send()).rejects.toThrow('Timeout')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
