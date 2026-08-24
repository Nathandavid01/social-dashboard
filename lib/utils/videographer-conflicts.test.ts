import { describe, it, expect } from 'vitest'
import { videographerConflictsInRange } from './videographer-conflicts'

function session(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    session_date: '2026-08-12',
    videographer_id: 'v1',
    status: 'scheduled',
    videographer: { full_name: 'María R.' },
    ...over,
  }
}

const august = new Date(2026, 7, 1)

describe('videographerConflictsInRange', () => {
  it('is empty when nobody is double-booked', () => {
    expect(videographerConflictsInRange([
      session(),
      session({ id: 's2', videographer_id: 'v2', videographer: { full_name: 'Diego V.' } }),
    ], august)).toEqual([])
  })

  it('flags the same videographer on two sessions the same day', () => {
    const conflicts = videographerConflictsInRange([
      session({ id: 's1' }),
      session({ id: 's2', title: 'Otra' }),
    ], august)
    expect(conflicts).toEqual([{
      videographerId: 'v1',
      videographerName: 'María R.',
      date: '2026-08-12',
      sessionIds: ['s1', 's2'],
    }])
  })

  it('ignores cancelled sessions and other months', () => {
    expect(videographerConflictsInRange([
      session({ id: 's1' }),
      session({ id: 's2', status: 'cancelled' }),
      session({ id: 's3', session_date: '2026-07-12' }),
      session({ id: 's4', session_date: '2026-07-12' }),
    ], august)).toEqual([])
  })
})
