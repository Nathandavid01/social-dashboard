import { describe, it, expect } from 'vitest'
import {
  resolveSlotTime,
  computeScheduleSlots,
  summarizeSlots,
  collectPostedDates,
} from './posting-schedule'

describe('resolveSlotTime', () => {
  it('prefers the per-day override in posting_schedule', () => {
    expect(resolveSlotTime(3, '14:30', { '3': '10:00' })).toBe('10:00')
  })

  it('falls back to the default posting_time when no override for that day', () => {
    expect(resolveSlotTime(1, '14:30', { '3': '10:00' })).toBe('14:30')
  })

  it('returns null when neither override nor default exists', () => {
    expect(resolveSlotTime(1, null, null)).toBeNull()
    expect(resolveSlotTime(1, null, {})).toBeNull()
    expect(resolveSlotTime(1, undefined, undefined)).toBeNull()
  })
})

describe('computeScheduleSlots', () => {
  // Week of Mon 2026-06-08 .. Sun 2026-06-14 (June 1 2026 is a Monday).
  const rangeStart = new Date(2026, 5, 8) // Mon
  const rangeEnd = new Date(2026, 5, 14) // Sun
  const ref = new Date(2026, 5, 11) // Thu

  it('emits one slot per matching posting day within the range, with resolved time', () => {
    const slots = computeScheduleSlots({
      postingDays: [1, 3, 5], // Mon, Wed, Fri
      postingTime: '14:30',
      postingSchedule: { '3': '10:00' }, // Wed override
      rangeStart,
      rangeEnd,
      postedDates: [],
      ref,
    })

    expect(slots.map((s) => s.date)).toEqual(['2026-06-08', '2026-06-10', '2026-06-12'])
    expect(slots.map((s) => s.dayOfWeek)).toEqual([1, 3, 5])
    expect(slots.map((s) => s.time)).toEqual(['14:30', '10:00', '14:30'])
  })

  it('marks a slot hecho when a post went out that date, falto when past & unposted, pendiente when today/future', () => {
    const slots = computeScheduleSlots({
      postingDays: [1, 3, 5],
      postingTime: '14:30',
      postingSchedule: { '3': '10:00' },
      rangeStart,
      rangeEnd,
      postedDates: ['2026-06-08'], // posted Monday only
      ref, // Thursday
    })

    const byDate = Object.fromEntries(slots.map((s) => [s.date, s.status]))
    expect(byDate['2026-06-08']).toBe('hecho') // posted
    expect(byDate['2026-06-10']).toBe('falto') // Wed, past, not posted
    expect(byDate['2026-06-12']).toBe('pendiente') // Fri, future
  })

  it('treats today as pendiente (not yet missed) when unposted', () => {
    const slots = computeScheduleSlots({
      postingDays: [4], // Thu == ref day
      postingTime: '14:30',
      postingSchedule: null,
      rangeStart,
      rangeEnd,
      postedDates: [],
      ref,
    })
    expect(slots).toHaveLength(1)
    expect(slots[0].date).toBe('2026-06-11')
    expect(slots[0].status).toBe('pendiente')
  })

  it('returns no slots when there are no posting days', () => {
    expect(
      computeScheduleSlots({
        postingDays: [],
        rangeStart,
        rangeEnd,
        postedDates: [],
        ref,
      }),
    ).toEqual([])
  })
})

describe('collectPostedDates', () => {
  it('collects local dates from idea published_at and non-draft Metricool posts', () => {
    const dates = collectPostedDates(
      [{ published_at: '2026-06-08T19:00:00+00:00' }, { published_at: null }],
      [
        { publicationDate: { dateTime: '2026-06-10T10:00:00' }, draft: false },
        { publicationDate: { dateTime: '2026-06-12T14:30:00' }, draft: true }, // draft → excluded
        { draft: false }, // no date → ignored
      ],
    )
    expect(dates.has('2026-06-08')).toBe(true)
    expect(dates.has('2026-06-10')).toBe(true)
    expect(dates.has('2026-06-12')).toBe(false)
    expect(dates.size).toBe(2)
  })

  it('handles empty/missing inputs', () => {
    expect(collectPostedDates([], []).size).toBe(0)
    expect(collectPostedDates(undefined, undefined).size).toBe(0)
  })
})

describe('summarizeSlots', () => {
  it('counts each status', () => {
    const summary = summarizeSlots([
      { date: '2026-06-08', dayOfWeek: 1, time: '14:30', status: 'hecho' },
      { date: '2026-06-10', dayOfWeek: 3, time: '10:00', status: 'falto' },
      { date: '2026-06-12', dayOfWeek: 5, time: '14:30', status: 'pendiente' },
      { date: '2026-06-15', dayOfWeek: 1, time: '14:30', status: 'hecho' },
    ])
    expect(summary).toEqual({ total: 4, hecho: 2, pendiente: 1, falto: 1 })
  })
})
