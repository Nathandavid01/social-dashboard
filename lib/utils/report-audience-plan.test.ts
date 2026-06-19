import { describe, it, expect } from 'vitest'
import { genderSplit, ageBuckets, topItems, buildDemographics } from './demographics-core'
import { parseBestTime, buildRecommendations, type PlanFacts } from './action-plan-core'

describe('demographics-core', () => {
  it('splits gender excluding unknown from the percentage', () => {
    expect(genderSplit({ M: 9081, F: 4786, U: 1870 })).toEqual({ femalePct: 35, malePct: 65, total: 15737 })
    expect(genderSplit({})).toEqual({ femalePct: 0, malePct: 0, total: 0 })
  })

  it('buckets ages in order with percentages, dropping empties', () => {
    const b = ageBuckets({ '18-24': 199, '25-34': 1536, '35-44': 4345, '45-54': 5471 })
    expect(b.map((x) => x.label)).toEqual(['18-24', '25-34', '35-44', '45-54'])
    expect(b[3].pct).toBe(47) // 5471 / 11551
  })

  it('takes top cities with short labels', () => {
    const t = topItems({ 'San Juan, San Juan': 2341, 'Bayamon, Bayamón': 1013, 'Carolina, Carolina': 723 }, 2, {
      cityShort: true,
    })
    expect(t.map((x) => x.label)).toEqual(['San Juan', 'Bayamon'])
    expect(t[0].value).toBe(2341)
  })

  it('buildDemographics flags hasData', () => {
    expect(buildDemographics({ M: 10, F: 10 }, {}, {}).hasData).toBe(true)
    expect(buildDemographics({}, {}, {}).hasData).toBe(false)
  })
})

describe('action-plan-core', () => {
  it('parses the peak best-time slot', () => {
    expect(parseBestTime({ '4': { '18': 1639, '6': 500 } })).toBe('jueves a las 18:00')
    expect(parseBestTime({})).toBeNull()
    expect(parseBestTime(null)).toBeNull()
  })

  it('builds prioritized recommendations from real data', () => {
    const f: PlanFacts = {
      winningFormat: 'Reels',
      bestTime: 'jueves a las 18:00',
      clicks: 340,
      saves: 120,
      reachDeltaPct: 23,
      posts: 9,
      periodDays: 30,
    }
    const r = buildRecommendations(f)
    expect(r.length).toBe(4)
    expect(r[0].title).toContain('Reels')
    expect(r.some((x) => x.tone === 'time')).toBe(true)
    expect(r.some((x) => x.tone === 'traffic')).toBe(true)
  })

  it('falls back to a momentum tip when there is little data', () => {
    const r = buildRecommendations({
      winningFormat: null,
      bestTime: null,
      clicks: 0,
      saves: 0,
      reachDeltaPct: -10,
      posts: 2,
      periodDays: 30,
    })
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r[r.length - 1].title.toLowerCase()).toContain('frecuencia')
  })
})
