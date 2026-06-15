import { describe, it, expect } from 'vitest'
import { clientProfilePatchSchema } from './client-profile.schema'

describe('clientProfilePatchSchema — posting time + schedule', () => {
  it('accepts a valid default posting_time (HH:MM)', () => {
    const r = clientProfilePatchSchema.safeParse({ posting_time: '14:30' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.posting_time).toBe('14:30')
  })

  it('normalizes empty posting_time to null', () => {
    const r = clientProfilePatchSchema.safeParse({ posting_time: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.posting_time).toBeNull()
  })

  it('rejects a malformed posting_time', () => {
    expect(clientProfilePatchSchema.safeParse({ posting_time: '25:99' }).success).toBe(false)
    expect(clientProfilePatchSchema.safeParse({ posting_time: '9am' }).success).toBe(false)
  })

  it('accepts a posting_schedule map of day → HH:MM', () => {
    const r = clientProfilePatchSchema.safeParse({ posting_schedule: { '1': '09:00', '5': '18:30' } })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.posting_schedule).toEqual({ '1': '09:00', '5': '18:30' })
  })

  it('rejects a posting_schedule with an invalid time value', () => {
    expect(clientProfilePatchSchema.safeParse({ posting_schedule: { '1': 'noon' } }).success).toBe(false)
  })

  it('rejects a posting_schedule keyed by a non day-of-week', () => {
    expect(clientProfilePatchSchema.safeParse({ posting_schedule: { '9': '09:00' } }).success).toBe(false)
  })
})
