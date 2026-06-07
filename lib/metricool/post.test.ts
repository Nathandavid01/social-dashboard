import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDraftPost } from './post'

function captureFetch() {
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 1, uuid: 'u' } }) }))
  vi.stubGlobal('fetch', spy)
  return spy
}
const body = (spy: ReturnType<typeof vi.fn>) => JSON.parse((spy.mock.calls[0][1] as { body: string }).body)

beforeEach(() => {
  process.env.METRICOOL_TOKEN = 'tok'
  process.env.METRICOOL_USER_ID = 'uid'
  process.env.METRICOOL_BLOG_ID = 'blog'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createDraftPost', () => {
  it('defaults to a DRAFT with no media (backwards compatible)', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', undefined, ['instagram'])
    const b = body(spy)
    expect(b.draft).toBe(true)
    expect(b.autoPublish).toBeUndefined()
    expect(b.media).toBeUndefined()
  })

  it('attaches media and auto-publishes a real post when opts are set', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'blog-9', ['instagram', 'tiktok'], undefined, '2026-06-15T10:00:00', {
      mediaUrls: ['https://videos.natemedia.com/ideas/x/edited/1-final.mp4'],
      autoPublish: true,
    })
    const b = body(spy)
    expect(b.draft).toBe(false)
    expect(b.autoPublish).toBe(true)
    expect(b.media).toEqual(['https://videos.natemedia.com/ideas/x/edited/1-final.mp4'])
    expect(b.publicationDate.dateTime).toBe('2026-06-15T10:00:00')
    expect(b.publicationDate.timezone).toBe('America/Puerto_Rico')
    expect(b.providers).toEqual([{ network: 'instagram' }, { network: 'tiktok' }])
  })

  it('throws when Metricool credentials are not configured', async () => {
    delete process.env.METRICOOL_TOKEN
    await expect(createDraftPost('hola')).rejects.toThrow(/credentials/i)
  })
})
