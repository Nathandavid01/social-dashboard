import { afterEach, describe, expect, it, vi } from 'vitest'
import { getScheduledPosts } from './scheduler'
const config = { userToken: 'test', userId: 'test', blogId: '1' }
afterEach(() => vi.unstubAllGlobals())
describe('direct scheduler verification', () => {
  it('accepts empty account responses and direct arrays', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }))
    expect(await getScheduledPosts(config, '2026-10-01', '2026-10-31')).toEqual([])
  })
  it('never treats a malformed response as a verified empty calendar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'Unavailable' }) }))
    await expect(getScheduledPosts(config, '2026-10-01', '2026-10-31')).rejects.toThrow('respuesta')
  })
})
