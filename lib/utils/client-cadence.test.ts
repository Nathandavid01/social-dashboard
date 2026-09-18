import { describe, expect, it } from 'vitest'
import {
  AGENCY_TIMEZONE,
  cadenceCalendarItems,
  cadenceRevalidatePaths,
  cadenceTimeForWeekday,
  cleanPostingDays,
  cleanPostingSchedule,
  cleanPostingTime,
  cleanTimezone,
  effectiveTimezone,
  formatCadenceDaysEs,
  formatCadenceSummaryEs,
  isCadenceTimezone,
  minutesSinceMidnightInTz,
  pipelineCadenceFromClient,
  readClientCadence,
} from './client-cadence'

describe('readClientCadence — never invents values', () => {
  it('returns an empty cadence when nothing was set', () => {
    expect(readClientCadence({})).toEqual({
      postingDays: [],
      postingTime: null,
      postingSchedule: {},
      timezone: null,
      postsPerWeek: 0,
    })
  })

  it('keeps stored posting_days / posting_time / posting_schedule / timezone', () => {
    const cadence = readClientCadence({
      posting_days: [1, 3, 5],
      posting_time: '14:00',
      posting_schedule: { '3': '18:30' },
      posting_timezone: 'America/Puerto_Rico',
    })
    expect(cadence.postingDays).toEqual([1, 3, 5])
    expect(cadence.postingTime).toBe('14:00')
    expect(cadence.postingSchedule).toEqual({ '3': '18:30' })
    expect(cadence.timezone).toBe('America/Puerto_Rico')
    expect(cadence.postsPerWeek).toBe(3)
  })

  it('does not fill days, times or timezone from defaults', () => {
    const cadence = readClientCadence({ posting_days: [2], posting_time: null, posting_schedule: null, posting_timezone: null })
    expect(cadence.postingTime).toBeNull()
    expect(cadence.postingSchedule).toEqual({})
    expect(cadence.timezone).toBeNull()
    expect(cadence.postsPerWeek).toBe(1)
  })

  it('drops invalid days instead of inventing a weekly pattern', () => {
    expect(cleanPostingDays([1, 1, 9, -1, 3])).toEqual([1, 3])
    expect(cleanPostingDays(null)).toEqual([])
  })

  it('drops invalid times instead of substituting 10:00', () => {
    expect(cleanPostingTime('14:30')).toBe('14:30')
    expect(cleanPostingTime('')).toBeNull()
    expect(cleanPostingTime('noon')).toBeNull()
    expect(cleanPostingTime('25:00')).toBeNull()
  })

  it('keeps only valid HH:MM overrides keyed by JS weekday', () => {
    expect(cleanPostingSchedule({ '1': '09:00', '9': '10:00', lun: '11:00', '3': 'nope' })).toEqual({ '1': '09:00' })
  })

  it('rejects unknown timezones rather than storing a guessed zone', () => {
    expect(cleanTimezone('America/Puerto_Rico')).toBe('America/Puerto_Rico')
    expect(cleanTimezone('Not/AZone')).toBeNull()
    expect(cleanTimezone('')).toBeNull()
    expect(isCadenceTimezone('UTC')).toBe(true)
    expect(isCadenceTimezone('Europe/Madrid')).toBe(false)
  })
})

describe('effectiveTimezone', () => {
  it('uses the stored zone when a person set one', () => {
    expect(effectiveTimezone({ timezone: 'America/New_York' })).toBe('America/New_York')
  })

  it('falls back to the agency zone for clock math without persisting it', () => {
    expect(effectiveTimezone({ timezone: null })).toBe(AGENCY_TIMEZONE)
  })
})

describe('cadenceTimeForWeekday', () => {
  it('prefers the per-day override, else the default, else null', () => {
    const cadence = readClientCadence({
      posting_days: [1, 3],
      posting_time: '14:00',
      posting_schedule: { '3': '18:30' },
    })
    expect(cadenceTimeForWeekday(cadence, 1)).toBe('14:00')
    expect(cadenceTimeForWeekday(cadence, 3)).toBe('18:30')
    expect(cadenceTimeForWeekday(cadence, 5)).toBeNull()
  })
})

describe('formatCadenceSummaryEs', () => {
  it('says Sin cadencia when no days were set', () => {
    expect(formatCadenceSummaryEs(readClientCadence({}))).toBe('Sin cadencia')
  })

  it('lists only the days and times a person set', () => {
    expect(
      formatCadenceSummaryEs(
        readClientCadence({
          posting_days: [1, 3, 5],
          posting_time: '14:00',
          posting_timezone: 'America/Puerto_Rico',
        }),
      ),
    ).toBe('3/sem · Lun · Mié · Vie · 14:00 · Puerto Rico')
  })

  it('omits time and timezone when they were never set', () => {
    expect(formatCadenceDaysEs([1, 5])).toBe('Lun · Vie')
    expect(formatCadenceSummaryEs(readClientCadence({ posting_days: [0] }))).toBe('1/sem · Dom')
  })
})

describe('cadenceCalendarItems — slots come only from stored days', () => {
  it('emits nothing when the client has no posting_days', () => {
    const items = cadenceCalendarItems(
      [{ id: 'c1', name: 'Arasibo', posting_days: [] }],
      new Date(2026, 8, 14),
      new Date(2026, 8, 20),
    )
    expect(items).toEqual([])
  })

  it('emits one slot per configured day in the window, with the stored time', () => {
    // 2026-09-14 is Monday.
    const items = cadenceCalendarItems(
      [
        {
          id: 'c1',
          name: 'Arasibo',
          posting_days: [1, 3],
          posting_time: '14:00',
          posting_schedule: { '3': '18:30' },
        },
      ],
      new Date(2026, 8, 14),
      new Date(2026, 8, 16),
    )
    expect(items.map((i) => ({ date: i.date.slice(0, 16), title: i.title, type: i.type }))).toEqual([
      { date: '2026-09-14T14:00', title: 'Cadencia · 14:00', type: 'cadencia' },
      { date: '2026-09-16T18:30', title: 'Cadencia · 18:30', type: 'cadencia' },
    ])
    expect(items[0].href).toBe('/clients/c1?tab=schedule')
    expect(items[0].clientName).toBe('Arasibo')
  })

  it('does not invent a time when none was set', () => {
    const items = cadenceCalendarItems(
      [{ id: 'c1', name: 'Arasibo', posting_days: [1] }],
      new Date(2026, 8, 14),
      new Date(2026, 8, 14),
    )
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Cadencia')
    expect(items[0].date.startsWith('2026-09-14T12:00')).toBe(true)
  })
})

describe('cadenceRevalidatePaths', () => {
  it('covers every surface that reads cadence', () => {
    const paths = cadenceRevalidatePaths('c1')
    expect(paths).toEqual(
      expect.arrayContaining([
        '/clients/c1',
        '/clients',
        '/pipeline',
        '/home',
        '/planning',
        '/calendar',
        '/produccion',
        '/banco',
        '/mi-dia',
        '/runway',
      ]),
    )
  })
})

describe('pipelineCadenceFromClient', () => {
  it('maps the live client row into the pipeline cadence shape', () => {
    expect(
      pipelineCadenceFromClient({
        posting_days: [1, 4],
        posting_time: '10:00',
        posting_schedule: { '4': '16:00' },
        posting_timezone: 'America/New_York',
        metricool_blog_id: '99',
      }),
    ).toEqual({
      postingDays: [1, 4],
      postingTime: '10:00',
      postingSchedule: { '4': '16:00' },
      timezone: 'America/New_York',
      metricoolBlogId: '99',
    })
  })
})

describe('minutesSinceMidnightInTz', () => {
  it('reads wall-clock minutes in the given zone', () => {
    // 16:30 UTC = 12:30 in Puerto Rico (AST, UTC-4).
    const now = new Date('2026-09-14T16:30:00Z')
    expect(minutesSinceMidnightInTz('America/Puerto_Rico', now)).toBe(12 * 60 + 30)
    expect(minutesSinceMidnightInTz('UTC', now)).toBe(16 * 60 + 30)
  })
})
