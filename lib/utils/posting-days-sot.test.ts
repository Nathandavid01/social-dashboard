import { describe, expect, it } from 'vitest'
import {
  cadenceRowsFromPostingDays,
  claimNextPostingSlot,
  isoWeekdayToJs,
  jsWeekdayToIso,
  occupiedDatesFromSiblings,
  occupiesCadenceSlot,
  postingDaysFromIsoWeekdays,
  schedulesAfterPostingDaysChange,
} from './posting-days-sot'

describe('weekday conversion (JS 0=Sun vs ISO 1=Mon)', () => {
  it('maps Sunday both ways', () => {
    expect(jsWeekdayToIso(0)).toBe(7)
    expect(isoWeekdayToJs(7)).toBe(0)
  })

  it('leaves Mon–Sat as the same number', () => {
    for (const d of [1, 2, 3, 4, 5, 6]) {
      expect(jsWeekdayToIso(d)).toBe(d)
      expect(isoWeekdayToJs(d)).toBe(d)
    }
  })
})

describe('claimNextPostingSlot — Lun / Mié / Vie in approval order', () => {
  const LMW = [1, 3, 5]

  it('first approval takes Monday, then Wednesday, then Friday, then next Monday', () => {
    const from = '2026-08-17' // Monday
    const first = claimNextPostingSlot({ postingDays: LMW, occupiedDates: [], fromISO: from })
    expect(first).toBe('2026-08-17')
    const second = claimNextPostingSlot({
      postingDays: LMW,
      occupiedDates: [first!],
      fromISO: from,
    })
    expect(second).toBe('2026-08-19')
    const third = claimNextPostingSlot({
      postingDays: LMW,
      occupiedDates: [first!, second!],
      fromISO: from,
    })
    expect(third).toBe('2026-08-21')
    const fourth = claimNextPostingSlot({
      postingDays: LMW,
      occupiedDates: [first!, second!, third!],
      fromISO: from,
    })
    expect(fourth).toBe('2026-08-24')
  })

  it('skips a posting day that already has an approved video', () => {
    expect(
      claimNextPostingSlot({
        postingDays: LMW,
        occupiedDates: ['2026-08-17'],
        fromISO: '2026-08-17',
      }),
    ).toBe('2026-08-19')
  })

  it('from mid-week does not go back to a Monday that already passed', () => {
    expect(
      claimNextPostingSlot({
        postingDays: LMW,
        occupiedDates: [],
        fromISO: '2026-08-20', // Thursday
      }),
    ).toBe('2026-08-21')
  })

  it('returns null when the client has no posting days', () => {
    expect(claimNextPostingSlot({ postingDays: [], occupiedDates: [], fromISO: '2026-08-17' })).toBeNull()
    expect(claimNextPostingSlot({ postingDays: null, occupiedDates: [], fromISO: '2026-08-17' })).toBeNull()
  })

  it('ignores junk weekdays and duplicate occupied dates', () => {
    expect(
      claimNextPostingSlot({
        postingDays: [1, 1, 99, -1],
        occupiedDates: ['2026-08-17', '2026-08-17', 'nope'],
        fromISO: '2026-08-17',
      }),
    ).toBe('2026-08-24')
  })
})

describe('occupiedDatesFromSiblings', () => {
  it('collects committed dates of other videos, not this one', () => {
    expect(
      occupiedDatesFromSiblings('me', [
        { id: 'me', publish_date: '2026-08-17', approval_status: 'approved' },
        { id: 'a', publish_date: '2026-08-17', approval_status: 'approved' },
        { id: 'b', publish_date: '2026-08-19', approval_status: 'submitted' },
        { id: 'c', publish_date: '2026-08-21', metricool_post_id: 1 },
      ]),
    ).toEqual(['2026-08-17', '2026-08-21'])
  })
})

describe('occupiesCadenceSlot', () => {
  it('only holds a date when the video is committed to that day', () => {
    expect(occupiesCadenceSlot({ publish_date: '2026-08-17', approval_status: 'approved' })).toBe(true)
    expect(occupiesCadenceSlot({ publish_date: '2026-08-17', published_at: 'x' })).toBe(true)
    expect(occupiesCadenceSlot({ publish_date: '2026-08-17', status: 'publicada' })).toBe(true)
    expect(occupiesCadenceSlot({ publish_date: '2026-08-17', metricool_post_id: 9 })).toBe(true)
    expect(occupiesCadenceSlot({ publish_date: '2026-08-17', approval_status: 'submitted' })).toBe(false)
    expect(occupiesCadenceSlot({ publish_date: null, approval_status: 'approved' })).toBe(false)
  })
})

describe('schedulesAfterPostingDaysChange', () => {
  it('drops days no longer in posting_days and adds Reel for new days', () => {
    const next = schedulesAfterPostingDaysChange(
      [
        { day_of_week: 1, content_type: 'R' },
        { day_of_week: 4, content_type: 'P' },
      ],
      [1, 5], // Mon + Fri
    )
    expect(next).toEqual([
      { day_of_week: 1, content_type: 'R' },
      { day_of_week: 5, content_type: 'R' },
    ])
  })

  it('keeps Reel and Post on a day that stays selected', () => {
    const next = schedulesAfterPostingDaysChange(
      [
        { day_of_week: 1, content_type: 'R' },
        { day_of_week: 1, content_type: 'P' },
      ],
      [1],
    )
    expect(next).toEqual([
      { day_of_week: 1, content_type: 'R' },
      { day_of_week: 1, content_type: 'P' },
    ])
  })
})

describe('cadenceRowsFromPostingDays', () => {
  it('uses posting_days as the only days; types come from schedules when present', () => {
    expect(
      cadenceRowsFromPostingDays([5], [{ day_of_week: 1, content_type: 'R' }, { day_of_week: 5, content_type: 'P' }]),
    ).toEqual([{ day_of_week: 5, content_type: 'P' }])
  })

  it('invents a Reel row when the profile day has no schedule row', () => {
    expect(cadenceRowsFromPostingDays([0], [])).toEqual([{ day_of_week: 7, content_type: 'R' }])
  })

  it('returns nothing when posting_days is empty — schedules do not invent days', () => {
    expect(cadenceRowsFromPostingDays([], [{ day_of_week: 3, content_type: 'R' }])).toEqual([])
  })
})

describe('postingDaysFromIsoWeekdays', () => {
  it('unique-sorts ISO days into JS posting_days', () => {
    expect(postingDaysFromIsoWeekdays([5, 1, 7, 1])).toEqual([0, 1, 5])
  })
})
