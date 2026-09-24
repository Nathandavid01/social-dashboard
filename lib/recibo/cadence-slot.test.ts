import { describe, expect, it } from 'vitest'
import { nextCadenceSlot } from './cadence-slot'

describe('nextCadenceSlot', () => {
  it('elige el próximo día de la cadencia con su hora', () => {
    const slot = nextCadenceSlot({
      postingDays: [5],
      postingTime: '18:00',
      todayISO: '2026-09-23',
    })
    expect(slot).toMatchObject({ ok: true, dateISO: '2026-09-25', time: '18:00' })
    if (slot.ok) expect(slot.label).toContain('6:00 p.m.')
  })

  it('dice cuando no hay días o no hay hora', () => {
    expect(nextCadenceSlot({ postingDays: [], postingTime: '18:00', todayISO: '2026-09-23' })).toEqual({
      ok: false,
      reason: 'sin-dias',
    })
    expect(nextCadenceSlot({ postingDays: [3], postingTime: null, todayISO: '2026-09-23' })).toEqual({
      ok: false,
      reason: 'sin-hora',
    })
  })
})
