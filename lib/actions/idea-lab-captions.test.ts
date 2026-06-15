/**
 * End-to-end chain test: an Idea Lab "quick caption" send must reach Metricool
 * with the publish FORMAT that matches the chosen content type. Everything is
 * real except Supabase (mocked client read), auth (mocked permission) and the
 * network (fetch stubbed so we can inspect the exact body Metricool would get).
 * This proves content_type flows: action input → createDraftPost → postFormatData
 * → Metricool payload — not just the pure helper in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth/server', () => ({ requirePermission: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Supabase: the client lookup returns a client wired to a Metricool blog +
// Instagram/Facebook platforms.
const client = {
  metricool_blog_id: 'blog-123',
  platforms: ['instagram', 'facebook'],
  default_platforms: ['instagram', 'facebook'],
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: client, error: null }) }) }),
    }),
  }),
}))

import { sendQuickCaptionToMetricool } from './idea-lab-captions'

/** Stub fetch and return the parsed JSON body of the (first) Metricool call. */
function captureFetch() {
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: 1, uuid: 'u' } }) }))
  vi.stubGlobal('fetch', spy)
  return spy
}
const bodyOf = (spy: ReturnType<typeof vi.fn>) =>
  JSON.parse((spy.mock.calls[0][1] as { body: string }).body)

beforeEach(() => {
  process.env.METRICOOL_TOKEN = 'tok'
  process.env.METRICOOL_USER_ID = 'uid'
  process.env.METRICOOL_BLOG_ID = 'blog'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// A safely-future date so the schedule validation passes regardless of the clock.
const FUTURE = { date: '2030-01-01', time: '10:00' }

describe('sendQuickCaptionToMetricool — type reaches the social network', () => {
  it('Reel (R) → IG/FB REEL', async () => {
    const spy = captureFetch()
    const res = await sendQuickCaptionToMetricool({
      clientId: 'c1',
      caption: 'mira esto',
      ...FUTURE,
      contentType: 'R',
      mediaUrl: 'https://v/x.mp4',
      autoPublish: true,
    })
    expect(res.ok).toBe(true)
    const b = bodyOf(spy)
    expect(b.instagramData).toEqual({ type: 'REEL', showReelOnFeed: true })
    expect(b.facebookData).toEqual({ type: 'REEL' })
    expect(b.media).toEqual(['https://v/x.mp4'])
  })

  it('Story (S) → IG/FB STORY', async () => {
    const spy = captureFetch()
    await sendQuickCaptionToMetricool({
      clientId: 'c1',
      caption: 'historia',
      ...FUTURE,
      contentType: 'S',
      mediaUrl: 'https://v/x.mp4',
      autoPublish: true,
    })
    const b = bodyOf(spy)
    expect(b.instagramData).toEqual({ type: 'STORY' })
    expect(b.facebookData).toEqual({ type: 'STORY' })
  })

  it('Post (P) → IG/FB feed POST', async () => {
    const spy = captureFetch()
    await sendQuickCaptionToMetricool({
      clientId: 'c1',
      caption: 'post',
      ...FUTURE,
      contentType: 'P',
      autoPublish: true,
    })
    const b = bodyOf(spy)
    expect(b.instagramData).toEqual({ type: 'POST' })
    expect(b.facebookData).toEqual({ type: 'POST' })
  })

  it('Carousel (C) → POST', async () => {
    const spy = captureFetch()
    await sendQuickCaptionToMetricool({
      clientId: 'c1',
      caption: 'carrusel',
      ...FUTURE,
      contentType: 'C',
      mediaUrl: 'https://v/1.jpg',
      autoPublish: true,
    })
    const b = bodyOf(spy)
    expect(b.instagramData).toEqual({ type: 'POST' })
  })
})
