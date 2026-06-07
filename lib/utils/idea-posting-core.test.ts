import { describe, it, expect } from 'vitest'
import { ideaPostReadiness, buildPublishDateTime, resolvePlatforms, type PostableIdea } from './idea-posting-core'

const ready: PostableIdea = {
  approval_status: 'approved',
  generated_caption: 'Un caption listo ✨ #post',
  status: 'producida',
  published_at: null,
  metricool_post_id: null,
}

const BLOG = 'blog-1'

describe('ideaPostReadiness', () => {
  it('is ready when approved + caption + edited video + blog id + not posted/published', () => {
    expect(ideaPostReadiness(ready, true, BLOG)).toEqual({ ready: true })
  })

  it('never re-posts once metricool_post_id is set (idempotency, checked first)', () => {
    const r = ideaPostReadiness({ ...ready, metricool_post_id: 12345 }, true, BLOG)
    expect(r.ready).toBe(false)
    expect(r.reason).toMatch(/ya se publicó/i)
  })

  it('blocks when not approved', () => {
    expect(ideaPostReadiness({ ...ready, approval_status: 'submitted' }, true, BLOG).ready).toBe(false)
  })

  it('blocks when the caption is missing or blank', () => {
    expect(ideaPostReadiness({ ...ready, generated_caption: null }, true, BLOG).ready).toBe(false)
    expect(ideaPostReadiness({ ...ready, generated_caption: '   ' }, true, BLOG).ready).toBe(false)
  })

  it('blocks when there is no edited video', () => {
    expect(ideaPostReadiness(ready, false, BLOG).reason).toMatch(/video editado/i)
  })

  it('blocks when already published', () => {
    expect(ideaPostReadiness({ ...ready, published_at: '2026-06-01' }, true, BLOG).ready).toBe(false)
    expect(ideaPostReadiness({ ...ready, status: 'publicada' }, true, BLOG).ready).toBe(false)
  })

  it('refuses (safety) when the client has no Metricool blog id — never posts to the default account', () => {
    expect(ideaPostReadiness(ready, true, null).ready).toBe(false)
    expect(ideaPostReadiness(ready, true, '   ').ready).toBe(false)
    expect(ideaPostReadiness(ready, true, undefined).reason).toMatch(/blog_id/i)
  })
})

describe('buildPublishDateTime', () => {
  const NOW = Date.UTC(2026, 5, 1, 12, 0, 0) // 2026-06-01T12:00:00Z

  it('schedules at the planned publish_date + the client posting_time', () => {
    expect(buildPublishDateTime('2026-06-15', '14:30', NOW)).toBe('2026-06-15T14:30:00')
  })

  it('defaults to 10:00 when the client has no posting_time', () => {
    expect(buildPublishDateTime('2026-06-15', null, NOW)).toBe('2026-06-15T10:00:00')
  })

  it('falls back to +24h from now when there is no planned date', () => {
    expect(buildPublishDateTime(null, '10:00', NOW)).toBe('2026-06-02T12:00:00')
  })

  it('clamps a PAST planned date to +24h so an overdue approval cannot publish immediately', () => {
    // planned 2026-05-20 is before "now" (2026-06-01) → fall back, not the past date
    expect(buildPublishDateTime('2026-05-20', '14:30', NOW)).toBe('2026-06-02T12:00:00')
  })
})

describe('resolvePlatforms', () => {
  it('prefers the client platforms, lowercased', () => {
    expect(resolvePlatforms(['Instagram', 'TikTok'], ['facebook'])).toEqual(['instagram', 'tiktok'])
  })
  it('falls back to default_platforms, then to the IG/FB/TikTok default', () => {
    expect(resolvePlatforms(null, ['Facebook'])).toEqual(['facebook'])
    expect(resolvePlatforms([], [])).toEqual(['instagram', 'facebook', 'tiktok'])
  })
})
