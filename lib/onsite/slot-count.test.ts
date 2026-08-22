import { describe, it, expect } from 'vitest'
import { emptyOnsiteSlots, onsiteSlotTarget, pickOnsiteSession, progressAgainstTarget, requiredForOnsite, groupOnsiteSessions } from './slot-count'
import type { OnsiteShot } from './shot-types'

const shot = (over: Partial<OnsiteShot> = {}): OnsiteShot => ({
  id: 'x',
  title: 'Toma',
  hook: null,
  visualBrief: null,
  viralityScore: null,
  viralityWhy: null,
  referenceUrl: null,
  shotType: 'sony',
  recorded: false,
  ...over,
})

describe('onsiteSlotTarget', () => {
  it('es el /mes del perfil × 1.5, redondeado', () => {
    expect(onsiteSlotTarget(9)).toBe(14)
    expect(onsiteSlotTarget(30)).toBe(45)
    expect(onsiteSlotTarget(4)).toBe(6)
  })

  it('sin frecuencia no inventa huecos', () => {
    expect(onsiteSlotTarget(0)).toBe(0)
    expect(onsiteSlotTarget(-3)).toBe(0)
  })
})

describe('emptyOnsiteSlots', () => {
  it('los huecos son el total menos las ideas ya en la sesión', () => {
    expect(emptyOnsiteSlots(20, 45)).toBe(25)
  })

  it('si ya hay más ideas que el total, no recorta: cero huecos', () => {
    expect(emptyOnsiteSlots(50, 45)).toBe(0)
  })
})

describe('progressAgainstTarget', () => {
  it('el total es el objetivo aunque falten ideas', () => {
    expect(progressAgainstTarget([shot({ recorded: true }), shot({ recorded: false })], 6)).toEqual({
      total: 6,
      recorded: 1,
      pending: 5,
      pct: 17,
    })
  })

  it('si hay más ideas que el objetivo, cuenta todas', () => {
    const shots = [
      shot({ id: '1', recorded: true }),
      shot({ id: '2', recorded: true }),
      shot({ id: '3', recorded: false }),
    ]
    expect(progressAgainstTarget(shots, 2)).toMatchObject({ total: 3, recorded: 2, pending: 1 })
  })
})

describe('requiredForOnsite', () => {
  it('usa el mismo /mes que Días de posting (Lun+Jue en ago 2026 = 9) × 1.5', () => {
    const r = requiredForOnsite({ postingDays: [1, 4], ref: new Date(2026, 7, 20) })
    expect(r.perWeek).toBe(2)
    expect(r.perMonth).toBe(9)
    expect(r.slotTarget).toBe(14)
  })

  it('sin días en el perfil no inventa videos', () => {
    const r = requiredForOnsite({ postingDays: [], ref: new Date(2026, 7, 20) })
    expect(r.perMonth).toBe(0)
    expect(r.slotTarget).toBe(0)
  })

  it('acepta días guardados como texto', () => {
    const r = requiredForOnsite({ postingDays: ['1', '4'] as unknown as number[], ref: new Date(2026, 7, 20) })
    expect(r.perMonth).toBe(9)
    expect(r.slotTarget).toBe(14)
  })
})

describe('pickOnsiteSession', () => {
  const s = (over: { id: string; date: string; slotTarget: number; clientId?: string | null }) => ({
    clientId: over.clientId ?? 'c1',
    ...over,
  })

  it('respeta el id pedido', () => {
    const lista = [
      s({ id: 'a', date: '2026-08-01', slotTarget: 45 }),
      s({ id: 'b', date: '2026-08-19', slotTarget: 6 }),
    ]
    expect(pickOnsiteSession(lista, 'a', '2026-08-19')?.id).toBe('a')
  })

  it('si no piden sesión, abre la próxima con cliente — no un Sin cliente viejo', () => {
    const lista = [
      s({ id: 'old', date: '2026-05-26', slotTarget: 0, clientId: null }),
      s({ id: 'past', date: '2026-08-01', slotTarget: 45, clientId: 'c1' }),
      s({ id: 'today', date: '2026-08-19', slotTarget: 23, clientId: 'c2' }),
    ]
    expect(pickOnsiteSession(lista, undefined, '2026-08-19')?.id).toBe('today')
  })

  it('si lo próximo no tiene /mes, abre el último cliente con cupo', () => {
    const lista = [
      s({ id: 'old', date: '2026-05-26', slotTarget: 0, clientId: null }),
      s({ id: 'blue', date: '2026-08-03', slotTarget: 20, clientId: 'c2' }),
      s({ id: 'pizza', date: '2026-08-29', slotTarget: 0, clientId: 'c3' }),
    ]
    expect(pickOnsiteSession(lista, undefined, '2026-08-20')?.id).toBe('blue')
  })
})

describe('groupOnsiteSessions', () => {
  it('pone Hoy primero y Sin cliente al final', () => {
    const g = groupOnsiteSessions(
      [
        { date: '2026-05-26', clientId: null },
        { date: '2026-08-21', clientId: 'c1' },
        { date: '2026-08-20', clientId: 'c2' },
      ],
      '2026-08-20',
    )
    expect(g.map((x) => x.lane)).toEqual(['hoy', 'proxima', 'sin_cliente'])
  })
})
