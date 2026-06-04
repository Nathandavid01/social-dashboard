import { describe, it, expect } from 'vitest'
import { planSessions, shouldPlanForClient, nextPostingDates, planSlots } from './planned-sessions'

describe('nextPostingDates', () => {
  it('returns the next N daily dates from `from` inclusive', () => {
    const from = new Date(2026, 5, 8) // Mon 2026-06-08
    const dates = nextPostingDates([0, 1, 2, 3, 4, 5, 6], 3, from)
    expect(dates).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })
  it('only includes the client posting weekdays (Mon & Thu)', () => {
    const from = new Date(2026, 5, 8) // Monday
    const dates = nextPostingDates([1, 4], 3, from)
    // Mon 8, Thu 11, Mon 15
    expect(dates).toEqual(['2026-06-08', '2026-06-11', '2026-06-15'])
  })
  it('returns [] with no posting days or zero count', () => {
    expect(nextPostingDates([], 5, new Date(2026, 5, 8))).toEqual([])
    expect(nextPostingDates([1], 0, new Date(2026, 5, 8))).toEqual([])
  })
})

describe('planSlots', () => {
  it('builds dated, indexed empty slots', () => {
    const slots = planSlots([0, 1, 2, 3, 4, 5, 6], 2, new Date(2026, 5, 8))
    expect(slots).toEqual([
      { index: 0, date: '2026-06-08' },
      { index: 1, date: '2026-06-09' },
    ])
  })
})

describe('shouldPlanForClient', () => {
  it('plans for an active client with cadence and no active ideas', () => {
    expect(shouldPlanForClient({ status: 'active', postingDaysLength: 7, activeIdeasCount: 0 })).toBe(true)
  })
  it('does not plan for paused/inactive clients', () => {
    expect(shouldPlanForClient({ status: 'paused', postingDaysLength: 7, activeIdeasCount: 0 })).toBe(false)
  })
  it('does not plan when the client has no posting cadence', () => {
    expect(shouldPlanForClient({ status: 'active', postingDaysLength: 0, activeIdeasCount: 0 })).toBe(false)
  })
  it('does not plan when the client already has ideas (real batch shows instead)', () => {
    expect(shouldPlanForClient({ status: 'active', postingDaysLength: 7, activeIdeasCount: 3 })).toBe(false)
  })
})

describe('planSessions', () => {
  it('splits a daily client (30/month, 2-week interval) into 2 cards of 15', () => {
    const s = planSessions({ monthlyTarget: 30, perWeek: 7, intervalWeeks: 2, ideasCount: 0 })
    expect(s).toHaveLength(2)
    expect(s.map((x) => x.total)).toEqual([15, 15])
    expect(s.every((x) => x.empty === 15 && x.filled === 0)).toBe(true)
  })

  it('returns one card covering the month when the interval is long', () => {
    const s = planSessions({ monthlyTarget: 30, perWeek: 7, intervalWeeks: 4, ideasCount: 0 })
    expect(s).toHaveLength(1)
    expect(s[0].total).toBe(30)
  })

  it('splits a weekly client (4/month, 2-week interval) into 2 cards of 2', () => {
    const s = planSessions({ monthlyTarget: 4, perWeek: 1, intervalWeeks: 2, ideasCount: 0 })
    expect(s.map((x) => x.total)).toEqual([2, 2])
  })

  it('fills earlier sessions first with existing ideas, leaving the rest empty', () => {
    const s = planSessions({ monthlyTarget: 30, perWeek: 7, intervalWeeks: 2, ideasCount: 18 })
    // 18 ideas across [15,15] → first session full (15), second has 3
    expect(s[0]).toMatchObject({ total: 15, filled: 15, empty: 0 })
    expect(s[1]).toMatchObject({ total: 15, filled: 3, empty: 12 })
  })

  it('distributes an odd monthly target evenly (larger sessions first)', () => {
    const s = planSessions({ monthlyTarget: 31, perWeek: 7, intervalWeeks: 2, ideasCount: 0 })
    // round(31/14)=2 → [16,15]
    expect(s.map((x) => x.total)).toEqual([16, 15])
  })

  it('returns no sessions when there is no cadence or no target', () => {
    expect(planSessions({ monthlyTarget: 0, perWeek: 7, intervalWeeks: 2, ideasCount: 0 })).toEqual([])
    expect(planSessions({ monthlyTarget: 30, perWeek: 0, intervalWeeks: 2, ideasCount: 0 })).toEqual([])
  })

  it('never exceeds the monthly target across sessions', () => {
    const s = planSessions({ monthlyTarget: 30, perWeek: 7, intervalWeeks: 2, ideasCount: 0 })
    expect(s.reduce((n, x) => n + x.total, 0)).toBe(30)
  })

  it('treats a missing/zero interval as at least 1 week', () => {
    const s = planSessions({ monthlyTarget: 7, perWeek: 7, intervalWeeks: 0, ideasCount: 0 })
    // sessionSize = 7*1 = 7 → round(7/7)=1 card of 7
    expect(s).toHaveLength(1)
    expect(s[0].total).toBe(7)
  })
})
