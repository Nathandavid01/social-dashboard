import { describe, it, expect } from 'vitest'
import {
  normalizeInstagramPost,
  normalizeFacebookPost,
  summarizeReport,
  sortPostsByDate,
  formatCompact,
} from './client-report-core'

describe('client-report-core', () => {
  it('normalizes an instagram post (reach, impressions, engagement, thumbnail)', () => {
    const p = normalizeInstagramPost(
      {
        timestamp: 1781794323000,
        url: 'https://instagram.com/p/X',
        imageUrl: 'https://img/x.jpg',
        content: 'hola',
        likes: 226,
        comments: 9,
        shares: 20,
        saved: 5,
        reach: 10000,
        impressions: 12000,
        interactions: 286,
        views: 4000,
      },
      'post',
    )
    expect(p.network).toBe('instagram')
    expect(p.type).toBe('post')
    expect(p.reach).toBe(10000)
    expect(p.impressions).toBe(12000)
    expect(p.likes).toBe(226)
    expect(p.engagement).toBe(286)
    expect(p.thumbnail).toBe('https://img/x.jpg')
  })

  it('normalizes a facebook post (impressionsUnique → reach, reactions → likes)', () => {
    const p = normalizeFacebookPost({
      timestamp: 1781797780000,
      permalinkUrl: 'https://fb.com/p',
      text: 'hi',
      reactions: 40,
      comments: 3,
      shares: 2,
      impressions: 9000,
      impressionsUnique: 5000,
    })
    expect(p.network).toBe('facebook')
    expect(p.reach).toBe(5000)
    expect(p.impressions).toBe(9000)
    expect(p.likes).toBe(40)
    expect(p.engagement).toBe(45) // 40+3+2
  })

  it('summarizes totals, network split, top post and engagement rate', () => {
    const posts = [
      normalizeInstagramPost({ timestamp: 2, reach: 100, impressions: 200, interactions: 10 }, 'post'),
      normalizeFacebookPost({ timestamp: 1, impressionsUnique: 300, impressions: 400, reactions: 20 }),
    ]
    const s = summarizeReport(posts)
    expect(s.posts).toBe(2)
    expect(s.reach).toBe(400)
    expect(s.impressions).toBe(600)
    expect(s.engagement).toBe(30) // 10 + 20
    expect(s.byNetwork).toEqual({ instagram: 1, facebook: 1 })
    expect(s.topPostIndex).toBe(1) // facebook reach 300 > 100
    expect(s.engagementRate).toBeCloseTo(30 / 400)
  })

  it('handles an empty report', () => {
    const s = summarizeReport([])
    expect(s.posts).toBe(0)
    expect(s.reach).toBe(0)
    expect(s.topPostIndex).toBe(-1)
    expect(s.engagementRate).toBe(0)
  })

  it('sorts posts newest first', () => {
    const a = normalizeInstagramPost({ timestamp: 1 }, 'post')
    const b = normalizeInstagramPost({ timestamp: 3 }, 'post')
    const c = normalizeInstagramPost({ timestamp: 2 }, 'post')
    expect(sortPostsByDate([a, b, c]).map((p) => p.timestamp)).toEqual([3, 2, 1])
  })

  it('formats compact numbers', () => {
    expect(formatCompact(950)).toBe('950')
    expect(formatCompact(12500)).toBe('13K')
    expect(formatCompact(1500)).toBe('1.5K')
    expect(formatCompact(9_636_238)).toBe('9.6M')
  })
})
