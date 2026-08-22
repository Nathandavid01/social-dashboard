import { describe, it, expect } from 'vitest'
import { alreadyCheckedIn, formatArrivalStamp } from './arrival'

describe('alreadyCheckedIn', () => {
  it('es true solo si esta persona ya selló esta sesión', () => {
    expect(alreadyCheckedIn('u1', [{ userId: 'u1' }])).toBe(true)
    expect(alreadyCheckedIn('u1', [{ userId: 'u2' }])).toBe(false)
    expect(alreadyCheckedIn(null, [{ userId: 'u1' }])).toBe(false)
  })
})

describe('formatArrivalStamp', () => {
  it('dice quién y a qué hora', () => {
    expect(formatArrivalStamp({ name: 'Ana Cruz', at: '2026-08-22T14:32:00.000Z' })).toMatch(/Ana Cruz/)
    expect(formatArrivalStamp({ name: 'Ana Cruz', at: '2026-08-22T14:32:00.000Z' })).toMatch(/llegó/i)
  })
})
