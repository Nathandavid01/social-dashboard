import { describe, expect, it } from 'vitest'
import { layoutStage, toArc } from './stage-layout'
import type { ClientStock, StockHealth } from './video-stock-core'

function c(id: string, health: StockHealth, daysLeft: number | null = 0): ClientStock {
  return {
    clientId: id, clientName: id, logoUrl: null, perWeek: 3, listos: 0, reels: 0, posts: 0, agendados: 0, crudo: 0,
    sinArchivo: 0, porGrabar: 0, salieron: 0, lastRawAt: null, daysLeft, runOutDate: null, runOutFormat: null, health,
    necesitaGrabar: false,
  }
}

describe('layoutStage', () => {
  const clients = [
    c('ok1', 'ok', 20), c('a1', 'agotado'), c('a2', 'agotado'), c('cr1', 'critico', 3),
    c('a3', 'agotado'), c('nc', 'sin_cadencia', null),
  ]
  const stage = layoutStage(clients, 2)

  it('groups clients into one tier per status, most urgent in front, empty statuses skipped', () => {
    expect(stage.tiers.map((t) => [t.health, t.count])).toEqual([
      ['agotado', 3],
      ['critico', 1],
      ['ok', 1],
      ['sin_cadencia', 1],
    ])
  })

  it('wraps a tier into rows of at most perRow and keeps the incoming order inside it', () => {
    const agotado = stage.items.filter((i) => i.health === 'agotado')
    expect(agotado.map((i) => [i.clientId, i.row, i.col])).toEqual([
      ['a1', 0, 0],
      ['a2', 0, 1],
      ['a3', 1, 0],
    ])
  })

  it('every next row sits further back and higher (stadium), so nothing hides behind the front', () => {
    const rows = [...new Set(stage.items.map((i) => i.row))].sort((a, b) => a - b)
    const z = rows.map((r) => stage.items.find((i) => i.row === r)!.z)
    const y = rows.map((r) => stage.items.find((i) => i.row === r)!.y)
    for (let k = 1; k < rows.length; k++) {
      expect(z[k]).toBeLessThan(z[k - 1])
      expect(y[k]).toBeGreaterThan(y[k - 1])
    }
  })

  it('centers each row on x = 0', () => {
    const row0 = stage.items.filter((i) => i.row === 0).map((i) => i.x)
    expect(row0[0] + row0[1]).toBeCloseTo(0)
    const lone = stage.items.find((i) => i.clientId === 'a3')!
    expect(lone.x).toBe(0)
  })

  it('a tier starts a new row even when the previous one has room', () => {
    const a3 = stage.items.find((i) => i.clientId === 'a3')!
    const cr1 = stage.items.find((i) => i.clientId === 'cr1')!
    expect(cr1.row).toBe(a3.row + 1)
  })

  it('reports the width of the widest row for camera framing', () => {
    expect(stage.width).toBeGreaterThan(0)
    expect(layoutStage([], 10)).toMatchObject({ items: [], tiers: [] })
  })
})

describe('toArc (amphitheater bend)', () => {
  it('keeps the front-row center in place', () => {
    const p = toArc(0, 0, 14)
    expect(p.x).toBeCloseTo(0)
    expect(p.z).toBeCloseTo(0)
    expect(p.angle).toBeCloseTo(0)
  })

  it('bends seats toward the viewer at the ends, symmetrically', () => {
    const left = toArc(-5, 0, 14)
    const right = toArc(5, 0, 14)
    expect(left.x).toBeCloseTo(-right.x)
    expect(left.z).toBeCloseTo(right.z)
    // Ends curve forward (toward the camera at +z).
    expect(right.z).toBeGreaterThan(0)
    // Arc length is preserved: the seat stays 5 units from center along the row.
    expect(right.angle * 14).toBeCloseTo(5)
  })

  it('back rows sit on a larger radius, further back', () => {
    expect(toArc(0, -4, 14).z).toBeCloseTo(-4)
    expect(toArc(3, -4, 14).angle).toBeCloseTo(3 / 18)
  })
})
