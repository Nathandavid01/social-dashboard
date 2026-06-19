import { describe, it, expect } from 'vitest'
import { deltaPct, deltaTone, formatDelta, previousWindow } from './report-delta-core'
import { aggregateClientMetrics, rankByReach, agencyTotals } from './agency-report-core'

describe('report-delta-core', () => {
  it('computes percent change and guards zero/undefined previous', () => {
    expect(deltaPct(150, 100)).toBe(50)
    expect(deltaPct(80, 100)).toBeCloseTo(-20)
    expect(deltaPct(10, 0)).toBeNull()
    expect(deltaPct(10, null)).toBeNull()
  })

  it('tones and formats deltas', () => {
    expect(deltaTone(12)).toBe('up')
    expect(deltaTone(-12)).toBe('down')
    expect(deltaTone(0)).toBe('flat')
    expect(deltaTone(null)).toBe('none')
    expect(formatDelta(12.4)).toBe('+12%')
    expect(formatDelta(-7.8)).toBe('-8%')
    expect(formatDelta(null)).toBe('—')
  })

  it('shifts the window back by its own length', () => {
    const now = 10_000_000_000
    const { start, end } = previousWindow(30, now)
    const ms = 30 * 24 * 60 * 60 * 1000
    expect(end).toBe(now - ms)
    expect(start).toBe(now - 2 * ms)
  })
})

describe('agency-report-core', () => {
  it('aggregates reach (ig+fb) and impressions', () => {
    const ig = { reach: 1000, views: 5000 }
    const fb = { page_impressions_unique: 300, page_posts_impressions: 2000 }
    expect(aggregateClientMetrics(ig, fb)).toEqual({ reach: 1300, impressions: 7000 })
    expect(aggregateClientMetrics({}, {})).toEqual({ reach: 0, impressions: 0 })
  })

  it('ranks by reach then impressions and totals', () => {
    const rows = [
      { id: 'a', name: 'A', reach: 100, impressions: 1 },
      { id: 'b', name: 'B', reach: 300, impressions: 1 },
      { id: 'c', name: 'C', reach: 0, impressions: 0 },
    ]
    expect(rankByReach(rows).map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(agencyTotals(rows)).toEqual({ clients: 3, clientsWithData: 2, reach: 400, impressions: 2 })
  })
})
