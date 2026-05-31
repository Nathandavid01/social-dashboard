import { describe, it, expect } from 'vitest'
import { computeRunway, TARGET_WEEKS } from './content-runway'

describe('computeRunway', () => {
  it('returns no_cadence when the client has no posting cadence', () => {
    const r = computeRunway({ ideas: 10, porEditar: 5, porPublicar: 3, weeklyCadence: 0 })
    expect(r.status).toBe('no_cadence')
    expect(r.minWeeks).toBeNull()
    expect(r.ideasWeeks).toBeNull()
  })

  it('computes weeks = count / weekly cadence per stage', () => {
    const r = computeRunway({ ideas: 12, porEditar: 8, porPublicar: 4, weeklyCadence: 4 })
    expect(r.ideasWeeks).toBe(3)
    expect(r.recordedWeeks).toBe(2)
    expect(r.editedWeeks).toBe(1)
    expect(r.minWeeks).toBe(1)
  })

  it('is "ok" when every stage is at least one month ahead', () => {
    const c = 3
    const r = computeRunway({ ideas: 4 * c, porEditar: 4 * c, porPublicar: 4 * c, weeklyCadence: c })
    expect(r.minWeeks).toBe(TARGET_WEEKS)
    expect(r.status).toBe('ok')
  })

  it('is "warn" when the weakest stage is between 2 and 4 weeks', () => {
    const r = computeRunway({ ideas: 16, porEditar: 12, porPublicar: 10, weeklyCadence: 4 }) // edited=2.5w
    expect(r.editedWeeks).toBe(2.5)
    expect(r.status).toBe('warn')
  })

  it('is "risk" when the weakest stage is below 2 weeks', () => {
    const r = computeRunway({ ideas: 16, porEditar: 16, porPublicar: 4, weeklyCadence: 4 }) // edited=1w
    expect(r.status).toBe('risk')
  })

  it('rounds weeks to one decimal', () => {
    const r = computeRunway({ ideas: 5, porEditar: 0, porPublicar: 0, weeklyCadence: 3 }) // 1.666 -> 1.7
    expect(r.ideasWeeks).toBe(1.7)
  })
})
