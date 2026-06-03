import { describe, it, expect } from 'vitest'
import { userAccent, UNASSIGNED_ACCENT } from './user-accent'

describe('userAccent', () => {
  it('is stable for the same user id', () => {
    expect(userAccent('u1')).toEqual(userAccent('u1'))
  })
  it('returns the neutral accent for unassigned (null/undefined)', () => {
    expect(userAccent(null)).toEqual(UNASSIGNED_ACCENT)
    expect(userAccent(undefined)).toEqual(UNASSIGNED_ACCENT)
  })
  it('gives different users different colors (spread across palette)', () => {
    const dots = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => userAccent(id).dot))
    expect(dots.size).toBeGreaterThan(1)
  })
})
