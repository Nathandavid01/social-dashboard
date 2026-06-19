import { describe, it, expect } from 'vitest'
import {
  reachByNetwork,
  reachTimeline,
  topPosts,
  topContentType,
  buildInsightPrompt,
  fallbackInsight,
  type InsightFacts,
} from './report-insights-core'
import type { ReportPost } from './client-report-core'

function post(p: Partial<ReportPost>): ReportPost {
  return {
    network: 'instagram',
    type: 'post',
    timestamp: 0,
    url: '',
    thumbnail: null,
    content: '',
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saved: 0,
    views: 0,
    engagement: 0,
    ...p,
  }
}

describe('report-insights-core', () => {
  it('splits reach by network', () => {
    expect(
      reachByNetwork([post({ network: 'instagram', reach: 100 }), post({ network: 'facebook', reach: 40 })]),
    ).toEqual({ instagram: 100, facebook: 40 })
  })

  it('buckets reach into a timeline within the window', () => {
    const now = 30 * 86400000
    const buckets = reachTimeline(
      [post({ timestamp: now - 2 * 86400000, reach: 500 }), post({ timestamp: now - 1000, reach: 200 })],
      30,
      now,
    )
    expect(buckets.length).toBe(Math.ceil(30 / 7))
    expect(buckets.reduce((a, b) => a + b.reach, 0)).toBe(700)
    expect(buckets[buckets.length - 1].reach).toBe(700) // both fall in the last week
  })

  it('picks top posts by reach', () => {
    const ps = [post({ reach: 10 }), post({ reach: 90 }), post({ reach: 50 })]
    expect(topPosts(ps, 2).map((p) => p.reach)).toEqual([90, 50])
  })

  it('finds the content type with most reach', () => {
    expect(
      topContentType([
        post({ type: 'reel', reach: 900 }),
        post({ type: 'post', reach: 100 }),
        post({ network: 'facebook', reach: 50 }),
      ]),
    ).toBe('Reels')
    expect(topContentType([])).toBe('—')
  })

  const facts: InsightFacts = {
    clientName: 'La Placita',
    periodDays: 30,
    reach: 12000,
    reachDeltaPct: 25,
    impressions: 30000,
    engagement: 1500,
    posts: 8,
    igPosts: 6,
    fbPosts: 2,
    topContentType: 'Reels',
    bestPostReach: 4000,
    bestPostExcerpt: 'promo del finde',
  }

  it('builds a prompt mentioning the client and key numbers', () => {
    const p = buildInsightPrompt(facts)
    expect(p).toContain('La Placita')
    expect(p).toContain('Reels')
    expect(p).toContain('30 días')
    expect(p.toLowerCase()).toContain('hacia dónde vamos')
  })

  it('produces a deterministic 3-section fallback', () => {
    const f = fallbackInsight(facts)
    expect(f).toContain('**Lo que logramos**')
    expect(f).toContain('**Qué está funcionando**')
    expect(f).toContain('**Hacia dónde vamos**')
  })
})
