import { describe, it, expect } from 'vitest'
import { pickReach } from './reach-core'

describe('reach-core', () => {
  it('reads the instagram reach key', () => {
    expect(pickReach({ reach: 32308, views: 188757, Followers: 137112 })).toBe(32308)
  })

  it('falls back to a facebook unique-reach key', () => {
    expect(pickReach({ page_impressions_unique: 5000, page_posts_impressions: 9999 })).toBe(5000)
  })

  it('does NOT count impressions-only objects as reach', () => {
    // facebook aggregation with no true reach key → 0 (impressions are not reach)
    expect(pickReach({ page_posts_impressions: 75345, pageViews: 2260 })).toBe(0)
  })

  it('ignores null/negative/NaN and non-objects', () => {
    expect(pickReach({ reach: null, page_impressions_unique: 30 })).toBe(30)
    expect(pickReach({ reach: -5 })).toBe(0)
    expect(pickReach({ reach: NaN })).toBe(0)
    expect(pickReach(null)).toBe(0)
    expect(pickReach('nope')).toBe(0)
    expect(pickReach({})).toBe(0)
  })
})
