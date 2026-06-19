import { describe, it, expect } from 'vitest'
import { postReach, sumPostReach } from './reach-core'

describe('reach-core', () => {
  it('prefers reach, then impressions, then plays', () => {
    expect(postReach({ reach: 100, impressions: 50 })).toBe(100)
    expect(postReach({ impressions: 50, plays: 9 })).toBe(50)
    expect(postReach({ plays: 9 })).toBe(9)
    expect(postReach({})).toBe(0)
  })

  it('ignores null/negative/NaN', () => {
    expect(postReach({ reach: null, impressions: 30 })).toBe(30)
    expect(postReach({ reach: -5 })).toBe(0)
    expect(postReach({ reach: NaN })).toBe(0)
  })

  it('sums reach across posts and tolerates junk', () => {
    expect(sumPostReach([{ reach: 100 }, { impressions: 50 }, { plays: 10 }])).toBe(160)
    expect(sumPostReach([])).toBe(0)
    expect(sumPostReach(null)).toBe(0)
    expect(sumPostReach('nope')).toBe(0)
    expect(sumPostReach([null, 5, { reach: 7 }])).toBe(7)
  })
})
