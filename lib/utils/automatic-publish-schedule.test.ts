import { describe, it, expect } from 'vitest'
import { automaticPublishSchedule } from './automatic-publish-schedule'
const now = Date.parse('2026-09-08T02:00:00Z') // Sep 7, 22:00 PR

describe('automatic Metricool schedule', () => {
  it('preserves tomorrow at the client time in Puerto Rico', () => {
    expect(automaticPublishSchedule('2026-09-08', '08:30:00', now)).toEqual({ok:true,iso:'2026-09-08T08:30:00'})
  })
  it('does not confuse the UTC day with the Puerto Rico day', () => {
    expect(automaticPublishSchedule('2026-09-07', '23:00', now)).toEqual({ok:true,iso:'2026-09-07T23:00:00'})
  })
  it.each([null, '', '2026-08-01', '2026-09-31'])('does not silently reschedule invalid or old dates: %s', date => {
    expect(automaticPublishSchedule(date, '10:00', now).ok).toBe(false)
  })
  it('blocks a time that already passed today', () => {
    expect(automaticPublishSchedule('2026-09-07', '10:00', now).ok).toBe(false)
  })
  it('keeps the existing 10am default when no posting time exists', () => {
    expect(automaticPublishSchedule('2026-09-08', null, now)).toEqual({ok:true,iso:'2026-09-08T10:00:00'})
  })
})
