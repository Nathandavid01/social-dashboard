import { describe, it, expect } from 'vitest'
import { startOfRangeISO } from './date-ranges'

describe('startOfRangeISO', () => {
  // Monday 2026-06-08 12:00 local.
  const now = new Date(2026, 5, 8, 12, 0, 0)

  it('returns null for "all" (no lower bound)', () => {
    expect(startOfRangeISO('all', now)).toBeNull()
  })

  it('returns the 1st of the current month for "month"', () => {
    expect(startOfRangeISO('month', now)).toBe('2026-06-01')
  })

  it('returns the Monday of the current week for "week"', () => {
    // 2026-06-08 is a Monday → week start is itself.
    expect(startOfRangeISO('week', now)).toBe('2026-06-08')
    // Wednesday 2026-06-10 → still Monday 2026-06-08.
    expect(startOfRangeISO('week', new Date(2026, 5, 10, 9, 0, 0))).toBe('2026-06-08')
    // Sunday 2026-06-14 → Monday is 2026-06-08 (week starts Monday).
    expect(startOfRangeISO('week', new Date(2026, 5, 14, 9, 0, 0))).toBe('2026-06-08')
  })
})
