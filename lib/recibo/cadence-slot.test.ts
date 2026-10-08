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

  it('dice cuando no hay días o no hay hora y pide fecha/hora a mano', () => {
    expect(nextCadenceSlot({ postingDays: [], postingTime: '18:00', todayISO: '2026-09-23' })).toEqual({
      ok: false,
      reason: 'sin-dias',
      needsManual: true,
    })
    expect(nextCadenceSlot({ postingDays: [3], postingTime: null, todayISO: '2026-09-23' })).toMatchObject({
      ok: false,
      reason: 'sin-hora',
      needsManual: true,
      dateISO: '2026-09-23',
    })
  })

  it('sin hora válida prellena el próximo día de cadencia', () => {
    const slot = nextCadenceSlot({
      postingDays: [1],
      postingTime: null,
      todayISO: '2026-10-08',
    })
    expect(slot).toMatchObject({
      ok: false,
      reason: 'sin-hora',
      needsManual: true,
      dateISO: '2026-10-12',
    })
  })

  it('reel o post en la hora no inventan 12:NaN y piden hora a mano', () => {
    const slot = nextCadenceSlot({
      postingDays: [2],
      postingTime: 'reel',
      todayISO: '2026-10-06',
    })
    expect(JSON.stringify(slot)).not.toMatch(/NaN/)
    expect(slot).toMatchObject({
      ok: false,
      reason: 'sin-hora',
      needsManual: true,
      dateISO: '2026-10-06',
    })
    if (!slot.ok) expect(slot.label ?? '').not.toMatch(/NaN/)
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
    expect(cadenceSlotForDate({ dateISO: '2026-10-07', postingTime: null })).toMatchObject({
      ok: false,
      reason: 'sin-hora',
      needsManual: true,
      dateISO: '2026-10-07',
    })
  })

  it('post en posting_time no produce NaN en la etiqueta', () => {
    const slot = cadenceSlotForDate({ dateISO: '2026-10-07', postingTime: 'post' })
    expect(slot.ok).toBe(false)
    expect(JSON.stringify(slot)).not.toMatch(/NaN/)
    if (!slot.ok) expect(slot.label ?? '').not.toMatch(/NaN/)
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

  it('espacio futuro sin hora válida pide hora a mano y conserva la fecha', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: '2026-10-13',
      postingDays: [1],
      postingTime: 'reel',
      todayISO: '2026-10-08',
    })).toMatchObject({
      ok: false,
      reason: 'sin-hora',
      needsManual: true,
      dateISO: '2026-10-13',
    })
  })

  it('sin días ni fecha de espacio pide fecha y hora a mano', () => {
    expect(reciboScheduleTarget({
      spaceDateISO: null,
      postingDays: [],
      postingTime: '11:19',
      todayISO: '2026-10-08',
    })).toMatchObject({ ok: false, reason: 'sin-dias', needsManual: true })
  })
})
