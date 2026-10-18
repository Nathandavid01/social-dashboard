import { describe, expect, it } from 'vitest'
import { cadenceSlotForDate, nextCadenceSlot, reciboScheduleTarget } from './cadence-slot'

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

describe('cadenceSlotForDate', () => {
  it('usa la fecha del espacio y la hora de cadencia, sin inventar otro día', () => {
    const slot = cadenceSlotForDate({
      dateISO: '2026-10-07',
      postingTime: '18:00',
    })
    expect(slot).toMatchObject({ ok: true, dateISO: '2026-10-07', time: '18:00' })
    if (slot.ok) expect(slot.label).toMatch(/miércoles 7 de octubre/i)
  })

  it('no inventa hora si el cliente no tiene posting_time ese día', () => {
    expect(cadenceSlotForDate({ dateISO: '2026-10-07', postingTime: null })).toEqual({
      ok: false,
      reason: 'sin-hora',
    })
  })
})

describe('reciboScheduleTarget', () => {
  it('programa el espacio futuro, no el próximo día suelto', () => {
    const slot = reciboScheduleTarget({
      spaceDateISO: '2026-10-09',
      postingDays: [1, 5],
      postingTime: '09:00',
      todayISO: '2026-10-04',
    })
    expect(slot).toMatchObject({ ok: true, dateISO: '2026-10-09', time: '09:00' })
  })

  it('si el espacio ya pasó, no inventa otra fecha', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: '2026-09-28',
      postingDays: [1, 3, 5],
      postingTime: '18:00',
      todayISO: '2026-10-04',
    })).toMatchObject({ ok: false, reason: 'pasado', dateISO: '2026-09-28' })
  })

  it('sin fecha de espacio sigue el comportamiento actual: próximo hueco de cadencia', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: null,
      postingDays: [5],
      postingTime: '18:00',
      todayISO: '2026-09-23',
    })).toMatchObject({ ok: true, dateISO: '2026-09-25' })
  })

  it('si el espacio es hoy pero la hora ya pasó, no programa en el pasado ni inventa otro día', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: '2026-10-04',
      postingDays: [0],
      postingTime: '09:00',
      todayISO: '2026-10-04',
      nowMs: Date.parse('2026-10-04T14:00:00-04:00'),
    })).toMatchObject({ ok: false, reason: 'pasado', dateISO: '2026-10-04' })
  })

  it('si el espacio es hoy y la hora todavía no llega, programa hoy', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: '2026-10-04',
      postingDays: [0],
      postingTime: '18:00',
      todayISO: '2026-10-04',
      nowMs: Date.parse('2026-10-04T14:00:00-04:00'),
    })).toMatchObject({ ok: true, dateISO: '2026-10-04', time: '18:00' })
  })
})
