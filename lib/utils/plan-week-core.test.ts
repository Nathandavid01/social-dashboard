import { describe, it, expect } from 'vitest'
import { planWeekInserts, type PlanWeekClient, type PlanWeekExistingIdea } from './plan-week-core'

// 2026-07-02 is a Thursday (getDay 4).
const TODAY = '2026-07-02'

function client(over: Partial<PlanWeekClient> = {}): PlanWeekClient {
  return { id: 'c1', name: 'Nora Fitness', status: 'active', posting_days: [1, 4], ...over } // Mon + Thu
}

describe('planWeekInserts — materializes the week of cadence cards', () => {
  it('creates one card per cadence day inside the window, starting today', () => {
    const inserts = planWeekInserts([client()], [], {}, TODAY, 7)
    // Thu 2, Mon 6, Thu 9 (window is today..today+7 inclusive).
    expect(inserts.map((i) => i.publish_date)).toEqual(['2026-07-02', '2026-07-06', '2026-07-09'])
    expect(inserts[0].client_id).toBe('c1')
    expect(inserts[0].content_type).toBe('R')
    expect(inserts[0].status).toBe('idea')
    expect(inserts[0].title).toMatch(/nora fitness/i)
    expect(inserts[0].title).toContain('2 jul')
  })

  it('skips dates that already have an idea — including discarded ones (team said no)', () => {
    const existing: PlanWeekExistingIdea[] = [{ client_id: 'c1', publish_date: '2026-07-06' }]
    const inserts = planWeekInserts([client()], existing, {}, TODAY, 7)
    expect(inserts.map((i) => i.publish_date)).toEqual(['2026-07-02', '2026-07-09'])
  })

  it('another client with an idea on the same date does NOT block this client', () => {
    const existing: PlanWeekExistingIdea[] = [{ client_id: 'OTRO', publish_date: '2026-07-06' }]
    const inserts = planWeekInserts([client()], existing, {}, TODAY, 7)
    expect(inserts).toHaveLength(3)
  })

  it('ignores inactive clients and clients without cadence', () => {
    expect(planWeekInserts([client({ status: 'paused' })], [], {}, TODAY, 7)).toEqual([])
    expect(planWeekInserts([client({ posting_days: [] })], [], {}, TODAY, 7)).toEqual([])
    expect(planWeekInserts([client({ posting_days: null })], [], {}, TODAY, 7)).toEqual([])
  })

  it('is idempotent: running twice with the first run persisted creates nothing new', () => {
    const first = planWeekInserts([client()], [], {}, TODAY, 7)
    const persisted = first.map((i) => ({ client_id: i.client_id, publish_date: i.publish_date }))
    expect(planWeekInserts([client()], persisted, {}, TODAY, 7)).toEqual([])
  })
})

describe('planWeekInserts — in-flight accounting (a busy client gets NO spam)', () => {
  it('every unpublished active idea consumes one upcoming slot', () => {
    // 3 window slots, 2 in-flight (e.g. undated videos being edited) → only 1 new card, the LAST slot.
    const inserts = planWeekInserts([client()], [], { c1: 2 }, TODAY, 7)
    expect(inserts.map((i) => i.publish_date)).toEqual(['2026-07-09'])
  })

  it('a full plate creates nothing — the batch card is never dragged back to Video', () => {
    expect(planWeekInserts([client()], [], { c1: 3 }, TODAY, 7)).toEqual([])
    expect(planWeekInserts([client()], [], { c1: 99 }, TODAY, 7)).toEqual([])
  })

  it('in-flight is per client — one busy client does not starve another', () => {
    const c2 = client({ id: 'c2', name: 'Lumen' })
    const inserts = planWeekInserts([client(), c2], [], { c1: 99 }, TODAY, 7)
    expect(inserts.every((i) => i.client_id === 'c2')).toBe(true)
    expect(inserts).toHaveLength(3)
  })

  it('in-flight consumes slots AFTER exact-date blocks (conservative: never over-creates)', () => {
    // Thu 2 blocked by an existing dated idea; 1 in-flight consumes Mon 6 → only Thu 9 created.
    const existing: PlanWeekExistingIdea[] = [{ client_id: 'c1', publish_date: '2026-07-02' }]
    const inserts = planWeekInserts([client()], existing, { c1: 1 }, TODAY, 7)
    expect(inserts.map((i) => i.publish_date)).toEqual(['2026-07-09'])
  })
})
