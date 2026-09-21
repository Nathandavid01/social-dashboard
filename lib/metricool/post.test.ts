import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDraftPost, postFormatData, updateScheduledPost } from './post'

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

  it('adds Reel format hints for IG/FB (not TikTok) when content_type is R', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'b', ['instagram', 'facebook', 'tiktok'], undefined, '2026-06-15T10:00:00', {
      mediaUrls: ['https://v/x.mp4'],
      autoPublish: true,
      contentType: 'R',
    })
    const b = body(spy)
    expect(b.instagramData).toEqual({ type: 'REEL', showReelOnFeed: true })
    expect(b.facebookData).toEqual({ type: 'REEL' })
    expect(b.tiktokData).toBeUndefined()
  })

  it('publishes a Story as a STORY on IG/FB when content_type is S', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'b', ['instagram', 'facebook'], undefined, '2026-06-15T10:00:00', {
      mediaUrls: ['https://v/x.mp4'],
      autoPublish: true,
      contentType: 'S',
    })
    const b = body(spy)
    expect(b.instagramData).toEqual({ type: 'STORY' })
    expect(b.facebookData).toEqual({ type: 'STORY' })
  })

  it('publishes a Post (P) as a feed POST on IG/FB', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'b', ['instagram', 'facebook'], undefined, '2026-06-15T10:00:00', {
      autoPublish: true,
      contentType: 'P',
    })
    const b = body(spy)
    expect(b.instagramData).toEqual({ type: 'POST' })
    expect(b.facebookData).toEqual({ type: 'POST' })
  })

  it('publishes a Carousel (C) as a POST (carousel inferred from media)', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'b', ['instagram'], undefined, '2026-06-15T10:00:00', {
      mediaUrls: ['https://v/1.jpg', 'https://v/2.jpg'],
      autoPublish: true,
      contentType: 'C',
    })
    const b = body(spy)
    expect(b.instagramData).toEqual({ type: 'POST' })
  })

  it('adds no format hints when content_type is unknown/null (backwards compatible)', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', 'b', ['instagram', 'facebook'], undefined, '2026-06-15T10:00:00', {
      autoPublish: true,
    })
    const b = body(spy)
    expect(b.instagramData).toBeUndefined()
    expect(b.facebookData).toBeUndefined()
  })

  it('retries WITHOUT the format hints if Metricool rejects the first attempt', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad format' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 7 } }) })
    vi.stubGlobal('fetch', spy)

    const res = await createDraftPost('hola', 'b', ['instagram', 'facebook'], undefined, '2026-06-15T10:00:00', {
      mediaUrls: ['https://v/x.mp4'],
      autoPublish: true,
      contentType: 'R',
    })

    expect(spy).toHaveBeenCalledTimes(2)
    const first = JSON.parse((spy.mock.calls[0][1] as { body: string }).body)
    const second = JSON.parse((spy.mock.calls[1][1] as { body: string }).body)
    expect(first.facebookData).toEqual({ type: 'REEL' })
    expect(second.facebookData).toBeUndefined() // retry drops the hints
    expect(second.instagramData).toBeUndefined()
    expect(res.data?.id).toBe(7)
  })
})


  it('attaches Instagram collaborators on Reel format data', async () => {
    const spy = captureFetch()
    await createDraftPost('hola', '5476146', ['instagram'], undefined, '2026-06-15T10:00:00', {
      autoPublish: true,
      contentType: 'R',
      instagramCollaborators: [
        { username: 'denniseyperez', deleted: false },
        { username: 'rafaellenin', deleted: false },
      ],
    })
    const b = body(spy)
    expect(b.instagramData).toEqual({
      type: 'REEL',
      showReelOnFeed: true,
      collaborators: [
        { username: 'denniseyperez', deleted: false },
        { username: 'rafaellenin', deleted: false },
      ],
    })
  })

describe('updateScheduledPost', () => {
  it('PUTs the full post (text/media/providers/uuid) to /v2/scheduler/posts/{id}', async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 99, uuid: 'u-44' } }) }))
    vi.stubGlobal('fetch', spy)

    const res = await updateScheduledPost(44, 'blog-9', {
      id: 44,
      uuid: 'u-44',
      text: 'Caption listo',
      draft: false,
      autoPublish: true,
      providers: [{ network: 'instagram' }],
      publicationDate: { dateTime: '2026-09-25T09:15:00', timezone: 'America/Puerto_Rico' },
      media: ['https://entregas.example/edited.mp4'],
      instagramData: { type: 'REEL', showReelOnFeed: true },
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const [url, init] = spy.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toContain('/v2/scheduler/posts/44')
    expect(url).toContain('blogId=blog-9')
    expect(url).toContain('userId=uid')
    expect(init.method).toBe('PUT')
    const b = JSON.parse(init.body)
    expect(b.uuid).toBe('u-44')
    expect(b.text).toBe('Caption listo')
    expect(b.media).toEqual(['https://entregas.example/edited.mp4'])
    expect(b.providers).toEqual([{ network: 'instagram' }])
    expect(b.publicationDate).toEqual({
      dateTime: '2026-09-25T09:15:00',
      timezone: 'America/Puerto_Rico',
    })
    expect(b.autoPublish).toBe(true)
    expect(res.data?.id).toBe(99)
  })

  it('throws when Metricool credentials are not configured', async () => {
    delete process.env.METRICOOL_TOKEN
    await expect(updateScheduledPost(44, 'blog-9', { text: 'x' })).rejects.toThrow(/credentials/i)
  })
})

describe('postFormatData', () => {
  it('maps a Reel (R) to REEL on IG (+showReelOnFeed) and FB', () => {
    expect(postFormatData('R', ['instagram', 'facebook', 'tiktok'])).toEqual({
      instagramData: { type: 'REEL', showReelOnFeed: true },
      facebookData: { type: 'REEL' },
    })
  })

  it('maps a Story (S) to STORY on IG and FB', () => {
    expect(postFormatData('S', ['instagram', 'facebook'])).toEqual({
      instagramData: { type: 'STORY' },
      facebookData: { type: 'STORY' },
    })
  })

  it('maps a Post (P) and a Carousel (C) to a feed POST', () => {
    expect(postFormatData('P', ['instagram', 'facebook'])).toEqual({
      instagramData: { type: 'POST' },
      facebookData: { type: 'POST' },
    })
    expect(postFormatData('C', ['instagram'])).toEqual({ instagramData: { type: 'POST' } })
  })

  it('scopes hints to the targeted networks only (TikTok has no format flag)', () => {
    expect(postFormatData('R', ['tiktok'])).toEqual({})
    expect(postFormatData('S', ['tiktok'])).toEqual({})
    expect(postFormatData('R', ['instagram'])).toEqual({ instagramData: { type: 'REEL', showReelOnFeed: true } })
  })

  it('returns nothing for an unknown/null content type', () => {
    expect(postFormatData(null, ['instagram', 'facebook'])).toEqual({})
    expect(postFormatData('X', ['instagram'])).toEqual({})
  })
})
