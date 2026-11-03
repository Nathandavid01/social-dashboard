import { describe, expect, it } from 'vitest'
import { calendarWriteNeedsMetricool } from './calendar-write-intent'

const scheduled = {
  currentDraft: false,
  currentDateTime: '2099-10-20T10:00:00',
  currentTimezone: 'America/Puerto_Rico',
}

describe('calendarWriteNeedsMetricool', () => {
  it('does not write to Metricool when the scheduled instant is unchanged', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'schedule',
      ...scheduled,
      requestedDateTime: '2099-10-20T10:00',
    })).toBe(false)
  })

  it('treats the same instant in another zone as a no-op', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'schedule',
      currentDraft: false,
      currentDateTime: '2099-10-20T14:00:00',
      currentTimezone: 'UTC',
      requestedDateTime: '2099-10-20T10:00',
    })).toBe(false)
  })

  it('writes when the user picks a new Puerto Rico date or time', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'schedule',
      ...scheduled,
      requestedDateTime: '2099-10-22T18:30',
    })).toBe(true)
  })

  it('writes when turning a draft into a scheduled post even at the same clock', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'schedule',
      currentDraft: true,
      currentDateTime: '2099-10-20T10:00:00',
      currentTimezone: 'America/Puerto_Rico',
      requestedDateTime: '2099-10-20T10:00',
    })).toBe(true)
  })

  it('does not write when the post is already a draft and the date is unchanged', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'draft',
      currentDraft: true,
      currentDateTime: '2099-10-20T10:00:00',
      currentTimezone: 'America/Puerto_Rico',
    })).toBe(false)
  })

  it('writes when a draft moves to another day without publishing', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'draft',
      currentDraft: true,
      currentDateTime: '2099-10-20T10:00:00',
      currentTimezone: 'America/Puerto_Rico',
      requestedDateTime: '2099-10-22T10:00',
    })).toBe(true)
  })

  it('always treats deleting a draft as a real change', () => {
    expect(calendarWriteNeedsMetricool({
      action: 'delete',
      currentDraft: true,
      currentDateTime: '2099-10-20T10:00:00',
      currentTimezone: 'America/Puerto_Rico',
    })).toBe(true)
  })
})
