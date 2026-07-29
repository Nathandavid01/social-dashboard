import { describe, it, expect } from 'vitest'
import {
  zonedNaiveToEpoch,
  validateScheduleOverride,
  toDatetimeLocalValue,
  MIN_LEAD_MS,
  POSTING_TZ,
} from './publish-override'

describe('zonedNaiveToEpoch', () => {
  it('reads a naive datetime as Puerto Rico local time (AST, UTC-4)', () => {
    // 10:00 in PR is 14:00 UTC — the conversion the Metricool 400 hinged on.
    expect(zonedNaiveToEpoch('2026-07-29T10:00:00', POSTING_TZ)).toBe(Date.UTC(2026, 6, 29, 14, 0, 0))
  })

  it('does not shift across the year — Puerto Rico has no DST', () => {
    expect(zonedNaiveToEpoch('2026-01-15T10:00:00', POSTING_TZ)).toBe(Date.UTC(2026, 0, 15, 14, 0, 0))
    expect(zonedNaiveToEpoch('2026-06-15T10:00:00', POSTING_TZ)).toBe(Date.UTC(2026, 5, 15, 14, 0, 0))
  })

  it('accepts a value without seconds', () => {
    expect(zonedNaiveToEpoch('2026-07-29T10:00', POSTING_TZ)).toBe(Date.UTC(2026, 6, 29, 14, 0, 0))
  })

  it('handles a zone that does observe DST, so the helper is not PR-only by accident', () => {
    // 2026-07-01 is EDT (UTC-4); 2026-01-01 is EST (UTC-5).
    expect(zonedNaiveToEpoch('2026-07-01T12:00:00', 'America/New_York')).toBe(Date.UTC(2026, 6, 1, 16, 0, 0))
    expect(zonedNaiveToEpoch('2026-01-01T12:00:00', 'America/New_York')).toBe(Date.UTC(2026, 0, 1, 17, 0, 0))
  })
})

describe('validateScheduleOverride', () => {
  // "Now" = 2026-07-29 11:05 AST — the moment Metricool rejected the 10:00 post.
  const NOW = Date.UTC(2026, 6, 29, 15, 5, 0)

  it('accepts a future time and normalizes it to a naive seconds string', () => {
    const r = validateScheduleOverride('2026-07-29T14:30', NOW)
    expect(r).toEqual({ ok: true, iso: '2026-07-29T14:30:00' })
  })

  it('rejects the exact case that produced the Metricool 400 (today at 10:00, already past)', () => {
    const r = validateScheduleOverride('2026-07-29T10:00', NOW)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/pasó/i)
  })

  it('rejects a time inside the upload lead window, so the video has time to upload', () => {
    // 11:05 AST + 4 min — future, but inside the 5-minute lead.
    const r = validateScheduleOverride('2026-07-29T11:09', NOW)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/5 minutos/i)
  })

  it('accepts a time just past the lead window', () => {
    // 11:05 AST + 5 min lead → 11:11 AST is safely outside it.
    expect(validateScheduleOverride('2026-07-29T11:11', NOW).ok).toBe(true)
  })

  it('rejects an empty or malformed value', () => {
    expect(validateScheduleOverride('', NOW).ok).toBe(false)
    expect(validateScheduleOverride(null, NOW).ok).toBe(false)
    expect(validateScheduleOverride('mañana a las 3', NOW).ok).toBe(false)
    expect(validateScheduleOverride('2026-13-45T99:99', NOW).ok).toBe(false)
  })

  it('accepts a date far in the future', () => {
    expect(validateScheduleOverride('2026-12-31T23:59', NOW)).toEqual({ ok: true, iso: '2026-12-31T23:59:00' })
  })
})

describe('toDatetimeLocalValue', () => {
  it('trims a naive seconds string down to what <input type="datetime-local"> wants', () => {
    expect(toDatetimeLocalValue('2026-07-29T10:00:00')).toBe('2026-07-29T10:00')
  })

  it('can nudge the value forward by an offset, for a sane default when the slot has passed', () => {
    expect(toDatetimeLocalValue('2026-07-29T10:00:00', 60 * 60 * 1000)).toBe('2026-07-29T11:00')
  })

  it('rolls into the next day when the nudge crosses midnight', () => {
    expect(toDatetimeLocalValue('2026-07-29T23:30:00', 60 * 60 * 1000)).toBe('2026-07-30T00:30')
  })
})
