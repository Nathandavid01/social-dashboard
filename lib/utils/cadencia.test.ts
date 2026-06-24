import { describe, it, expect } from 'vitest'
import {
  buildCadencia,
  buildConfirmation,
  confirmationMapFromPosts,
  weekdayOf,
  postingTimeToMinutes,
  mondayIndex,
  weekDaysMon,
  percent,
  type CadenciaClientInput,
} from './cadencia'

const WEEK = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']
// 2026-06-22 is a Monday; "today" = Thursday 2026-06-25.
// getDay() indices this week: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
const TODAY = '2026-06-25'
const NOON = 12 * 60

function client(
  partial: Partial<CadenciaClientInput> & Pick<CadenciaClientInput, 'clientId' | 'clientName'>,
): CadenciaClientInput {
  return {
    platforms: [],
    postingTime: null,
    postingDays: [],
    publishedDates: [],
    errorDates: [],
    pendingDates: [],
    liveUrlsByDate: {},
    ...partial,
  }
}

describe('postingTimeToMinutes', () => {
  it('parses HH:MM', () => {
    expect(postingTimeToMinutes('14:30')).toBe(14 * 60 + 30)
    expect(postingTimeToMinutes('09:00')).toBe(540)
  })
  it('returns null for missing/invalid', () => {
    expect(postingTimeToMinutes(null)).toBeNull()
    expect(postingTimeToMinutes('nope')).toBeNull()
    expect(postingTimeToMinutes('99:99')).toBeNull()
  })
})

describe('mondayIndex', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(mondayIndex('2026-06-22')).toBe(0) // Monday
    expect(mondayIndex('2026-06-25')).toBe(3) // Thursday
    expect(mondayIndex('2026-06-28')).toBe(6) // Sunday
  })
})

describe('weekdayOf (getDay convention, matches posting_days)', () => {
  it('maps Sunday to 0 and Saturday to 6', () => {
    expect(weekdayOf('2026-06-28')).toBe(0) // Sunday
    expect(weekdayOf('2026-06-22')).toBe(1) // Monday
    expect(weekdayOf('2026-06-23')).toBe(2) // Tuesday
    expect(weekdayOf('2026-06-27')).toBe(6) // Saturday
  })
})

describe('buildConfirmation', () => {
  it('confirms when every provider PUBLISHED, surfacing a url', () => {
    expect(buildConfirmation({ id: 1, providers: [{ status: 'PUBLISHED', publicUrl: 'http://x' }] })).toEqual({
      state: 'confirmed',
      url: 'http://x',
    })
  })
  it('fails when any provider ERROR', () => {
    expect(buildConfirmation({ id: 1, providers: [{ status: 'PUBLISHED' }, { status: 'ERROR' }] })).toEqual({
      state: 'failed',
    })
  })
  it('pending when mixed but no error', () => {
    expect(buildConfirmation({ id: 1, providers: [{ status: 'PUBLISHED' }, { status: 'PENDING' }] })).toEqual({
      state: 'pending',
    })
  })
  it('skips drafts and empty', () => {
    expect(buildConfirmation({ id: 1, draft: true, providers: [{ status: 'PUBLISHED' }] })).toBeNull()
    expect(buildConfirmation({ id: 1, providers: [] })).toBeNull()
  })
})

describe('confirmationMapFromPosts', () => {
  it('keys confirmations by post id, dropping nulls', () => {
    const map = confirmationMapFromPosts([
      { id: 10, providers: [{ status: 'PUBLISHED', publicUrl: 'u' }] },
      { id: 11, draft: true, providers: [{ status: 'PUBLISHED' }] },
    ])
    expect(map[10]).toEqual({ state: 'confirmed', url: 'u' })
    expect(map[11]).toBeUndefined()
  })
})

describe('buildCadencia — meta (posting_days) vs Metricool reality', () => {
  it('counts week ring as fulfilled-expected / expected days', () => {
    // posts Tue/Thu/Sat (meta = 3). Published Tue(23) + Thu(25); Sat(27) is future.
    const c = client({
      clientId: 'a',
      clientName: 'A',
      postingDays: [2, 4, 6],
      publishedDates: ['2026-06-23', '2026-06-25'],
    })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.week.planned).toBe(3)
    expect(d.week.published).toBe(2)
    // Sat is still upcoming → pending, none overdue.
    expect(d.week.pending).toBe(1)
    expect(d.week.overdue).toBe(0)
  })

  it('marks an expected day in the past with no post as atrasado', () => {
    // posts Mon/Wed (meta=2). Today Thu. Mon(22) & Wed(24) both past, nothing published.
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [1, 3] })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.week.planned).toBe(2)
    expect(d.week.published).toBe(0)
    expect(d.week.overdue).toBe(2)
  })

  it('today ring reflects only today', () => {
    // expects Thu (today). One published today.
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [4], publishedDates: [TODAY] })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.today.planned).toBe(1)
    expect(d.today.published).toBe(1)
  })

  it('today expected, not published, time passed → overdue', () => {
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [4], postingTime: '09:00' })
    const d = buildCadencia([c], WEEK, TODAY, NOON) // noon > 09:00
    expect(d.today.overdue).toBe(1)
    expect(d.today.pending).toBe(0)
  })

  it('today expected, not published, time NOT yet passed → pending', () => {
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [4], postingTime: '18:00' })
    const d = buildCadencia([c], WEEK, TODAY, NOON) // noon < 18:00
    expect(d.today.pending).toBe(1)
    expect(d.today.overdue).toBe(0)
  })

  it('Metricool ERROR on an expected day → overdue + failedCount on the row', () => {
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [2], errorDates: ['2026-06-23'] })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.week.overdue).toBe(1)
    const row = d.byDay['2026-06-23'].find((r) => r.clientId === 'a')!
    expect(row.failedCount).toBe(1)
    expect(row.hasOverdue).toBe(true)
  })

  it('client with no posting_days (sin meta) shows published reality but does not affect rings', () => {
    const c = client({
      clientId: 'a',
      clientName: 'A',
      postingDays: [],
      publishedDates: ['2026-06-23', '2026-06-23'],
      liveUrlsByDate: { '2026-06-23': ['http://live'] },
    })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    // No meta → rings see nothing.
    expect(d.week.planned).toBe(0)
    expect(d.week.published).toBe(0)
    // But the drilldown still shows the 2 published posts for that day.
    const row = d.byDay['2026-06-23'].find((r) => r.clientId === 'a')!
    expect(row.published).toBe(2)
    expect(row.dots.filter((s) => s === 'publicado')).toHaveLength(2)
    expect(row.liveUrls).toContain('http://live')
  })

  it('scopes the live-confirmation url to the day it was published (no leaking across days)', () => {
    // Published Tue (with live url); also expects Wed but nothing out Wed yet.
    const c = client({
      clientId: 'a',
      clientName: 'A',
      postingDays: [2, 3], // Tue + Wed
      publishedDates: ['2026-06-23'],
      liveUrlsByDate: { '2026-06-23': ['http://live-tue'] },
    })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    const tue = d.byDay['2026-06-23'].find((r) => r.clientId === 'a')!
    const wed = d.byDay['2026-06-24'].find((r) => r.clientId === 'a')!
    expect(tue.liveUrls).toEqual(['http://live-tue'])
    expect(wed.liveUrls).toEqual([]) // Wed has no published post → no live badge
    expect(wed.published).toBe(0)
  })

  it('bonus publish on a non-expected day still shows in the row', () => {
    // expects Tue only; published Tue (expected) AND Wed (bonus).
    const c = client({
      clientId: 'a',
      clientName: 'A',
      postingDays: [2],
      publishedDates: ['2026-06-23', '2026-06-24'],
    })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.week.planned).toBe(1)
    expect(d.week.published).toBe(1) // only the expected Tue counts for adherence
    const wed = d.byDay['2026-06-24'].find((r) => r.clientId === 'a')!
    expect(wed.published).toBe(1) // bonus still visible
  })

  it('builds 7 day buckets and per-day published/planned', () => {
    const c = client({ clientId: 'a', clientName: 'A', postingDays: [2, 4], publishedDates: ['2026-06-23'] })
    const d = buildCadencia([c], WEEK, TODAY, NOON)
    expect(d.days).toHaveLength(7)
    const tue = d.days.find((x) => x.date === '2026-06-23')!
    expect(tue.planned).toBe(1)
    expect(tue.published).toBe(1)
    const thu = d.days.find((x) => x.date === TODAY)!
    expect(thu.planned).toBe(1)
    expect(thu.published).toBe(0)
    // expected today but no posting_time → we can't say the slot passed → pending, NOT overdue.
    expect(thu.hasOverdue).toBe(false)
  })

  it('sorts client rows by name then id deterministically', () => {
    const b = client({ clientId: 'b', clientName: 'Zeta', postingDays: [2], publishedDates: ['2026-06-23'] })
    const a = client({ clientId: 'a', clientName: 'Alfa', postingDays: [2], publishedDates: ['2026-06-23'] })
    const d = buildCadencia([b, a], WEEK, TODAY, NOON)
    const names = d.byDay['2026-06-23'].map((r) => r.clientName)
    expect(names).toEqual(['Alfa', 'Zeta'])
  })

  it('exposes todayDate', () => {
    const d = buildCadencia([], WEEK, TODAY, NOON)
    expect(d.todayDate).toBe(TODAY)
  })
})

describe('weekDaysMon', () => {
  it('returns Monday→Sunday for the week containing a date', () => {
    const days = weekDaysMon(new Date(2026, 5, 25)) // Thu Jun 25 2026
    expect(days[0]).toBe('2026-06-22')
    expect(days[6]).toBe('2026-06-28')
  })
})

describe('percent', () => {
  it('rounds published/planned', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 0)).toBe(0)
  })
})
