import { describe, it, expect } from 'vitest'
<<<<<<< Updated upstream
import { approvedIdeaSendReadiness, buildScheduledDateTime, quickSendMediaOptions, scheduleDateError, scheduleMinDate, defaultScheduleDate, nowMinuteInPostTZ, autopublishTimeError } from './idea-lab-send-core'
import { addDaysISO } from './deadlines'

describe('quickSendMediaOptions', () => {
  const url = 'https://v.nmedia.dev/quick/c1/edited/1-x.mp4'

  it('attaches the video when a media URL is given', () => {
    expect(quickSendMediaOptions(url, false)).toEqual({ mediaUrls: [url], autoPublish: false })
    expect(quickSendMediaOptions(url, true)).toEqual({ mediaUrls: [url], autoPublish: true })
  })
  it('omits media when there is no video, keeping the chosen publish mode', () => {
    expect(quickSendMediaOptions(null, true)).toEqual({ autoPublish: true })
    expect(quickSendMediaOptions('   ', false)).toEqual({ autoPublish: false })
  })
  it('defaults to a draft (autoPublish=false) when the mode is not given', () => {
    expect(quickSendMediaOptions(url)).toEqual({ mediaUrls: [url], autoPublish: false })
    expect(quickSendMediaOptions()).toEqual({ autoPublish: false })
  })
})
=======
import { approvedIdeaSendReadiness, buildScheduledDateTime } from './idea-lab-send-core'
>>>>>>> Stashed changes

describe('approvedIdeaSendReadiness', () => {
  const ok = { generated_caption: 'Hola mundo', metricool_post_id: null }

  it('is ready with caption + blog id + not yet sent', () => {
    expect(approvedIdeaSendReadiness(ok, 'blog-123')).toEqual({ ready: true })
  })

  it('refuses when already sent (idempotency) before anything else', () => {
    const r = approvedIdeaSendReadiness({ ...ok, metricool_post_id: 42 }, 'blog-123')
    expect(r).toEqual({ ready: false, reason: 'Ya se envió a Metricool' })
  })

  it('refuses when the caption is missing or blank', () => {
    expect(approvedIdeaSendReadiness({ ...ok, generated_caption: null }, 'blog-123').ready).toBe(false)
    expect(approvedIdeaSendReadiness({ ...ok, generated_caption: '   ' }, 'blog-123').reason).toMatch(/caption/i)
  })

  it('refuses when the client has no Metricool blog id', () => {
    expect(approvedIdeaSendReadiness(ok, null).ready).toBe(false)
    expect(approvedIdeaSendReadiness(ok, '   ').reason).toMatch(/Metricool/)
  })
})

describe('buildScheduledDateTime', () => {
  it('combines date + time into a naive local datetime', () => {
    expect(buildScheduledDateTime('2026-06-15', '14:30')).toBe('2026-06-15T14:30:00')
  })

  it('defaults to 10:00 when no time is given', () => {
    expect(buildScheduledDateTime('2026-06-15')).toBe('2026-06-15T10:00:00')
    expect(buildScheduledDateTime('2026-06-15', null)).toBe('2026-06-15T10:00:00')
  })

  it('pads single-digit hours and clamps out-of-range hours', () => {
    expect(buildScheduledDateTime('2026-06-15', '9:05')).toBe('2026-06-15T09:05:00')
    expect(buildScheduledDateTime('2026-06-15', '30:00')).toBe('2026-06-15T23:00:00')
  })

  it('returns null for a missing or malformed date', () => {
    expect(buildScheduledDateTime(null, '10:00')).toBeNull()
    expect(buildScheduledDateTime('', '10:00')).toBeNull()
    expect(buildScheduledDateTime('06/15/2026', '10:00')).toBeNull()
  })

  it('falls back to 10:00 when the time is malformed', () => {
    expect(buildScheduledDateTime('2026-06-15', 'noon')).toBe('2026-06-15T10:00:00')
  })
})
<<<<<<< Updated upstream

describe('scheduleDateError', () => {
  const today = '2026-06-14'

  it('accepts today and any future date', () => {
    expect(scheduleDateError('2026-06-14', today)).toBeNull()
    expect(scheduleDateError('2026-06-20', today)).toBeNull()
  })

  it('rejects a date before today (no scheduling in the past)', () => {
    expect(scheduleDateError('2026-06-13', today)).toMatch(/pasó/i)
    expect(scheduleDateError('2020-01-01', today)).toMatch(/pasó/i)
  })

  it('rejects a missing or malformed date', () => {
    expect(scheduleDateError(null, today)).toMatch(/válida/i)
    expect(scheduleDateError('', today)).toMatch(/válida/i)
    expect(scheduleDateError('06/14/2026', today)).toMatch(/válida/i)
  })

  it('defaults "today" to the posting timezone, so a late-night PR instant is not rejected', () => {
    // 2026-06-15 02:00 UTC = 2026-06-14 22:00 in Puerto Rico. Scheduling for the
    // 14th (the PR "today") must pass even though UTC has already rolled to the 15th.
    const prToday = scheduleMinDate(new Date('2026-06-15T02:00:00Z'))
    expect(prToday).toBe('2026-06-14')
    expect(scheduleDateError('2026-06-14', prToday)).toBeNull()
  })
})

describe('nowMinuteInPostTZ', () => {
  it('returns "YYYY-MM-DDTHH:MM" in the posting timezone', () => {
    // 2026-06-15 02:00 UTC = 2026-06-14 22:00 in Puerto Rico (UTC-4).
    expect(nowMinuteInPostTZ(new Date('2026-06-15T02:00:00Z'))).toBe('2026-06-14T22:00')
  })
})

describe('autopublishTimeError', () => {
  const now = '2026-06-14T15:30'

  it('exempts drafts regardless of time', () => {
    expect(autopublishTimeError('2026-06-14T08:00:00', false, now)).toBeNull()
    expect(autopublishTimeError('2020-01-01T00:00:00', false, now)).toBeNull()
  })

  it('allows a future datetime for auto-publish (later today or another day)', () => {
    expect(autopublishTimeError('2026-06-14T16:00:00', true, now)).toBeNull()
    expect(autopublishTimeError('2026-06-15T09:00:00', true, now)).toBeNull()
  })

  it('rejects a same-day earlier time for auto-publish', () => {
    expect(autopublishTimeError('2026-06-14T08:00:00', true, now)).toMatch(/hora ya pasó/i)
  })
})

describe('schedule defaults (posting timezone)', () => {
  it('default schedule date is one day after the min (earliest) date', () => {
    const min = scheduleMinDate()
    expect(min).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(defaultScheduleDate()).toBe(addDaysISO(min, 1))
  })
  it('resolves to the Puerto Rico calendar day for a fixed instant', () => {
    const instant = new Date('2026-06-15T02:00:00Z') // 10pm AST on the 14th
    expect(scheduleMinDate(instant)).toBe('2026-06-14')
    expect(defaultScheduleDate(instant)).toBe('2026-06-15')
  })
})
=======
>>>>>>> Stashed changes
