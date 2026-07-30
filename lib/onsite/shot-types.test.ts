import { describe, it, expect } from 'vitest'
import { groupShots, progressOf, shotTypeLabel, SHOT_TYPES, type OnsiteShot } from './shot-types'

const shot = (over: Partial<OnsiteShot> = {}): OnsiteShot => ({
  id: 'x', title: 'Toma', hook: null, referenceUrl: null, shotType: 'sony', recorded: false, ...over,
})

describe('SHOT_TYPES', () => {
  it('son los cuatro tipos, en orden', () => {
    expect(SHOT_TYPES.map((t) => t.label)).toEqual([
      'DJI', 'DJI First Person POV', 'Sony', 'Fotos de Producto',
    ])
  })
  it('un tipo desconocido se lee como "Sin tipo"', () => {
    expect(shotTypeLabel('gopro')).toBe('Sin tipo')
    expect(shotTypeLabel(null)).toBe('Sin tipo')
  })
})

describe('groupShots', () => {
  it('agrupa por tipo respetando el orden de SHOT_TYPES', () => {
    const g = groupShots([
      shot({ id: '1', shotType: 'sony' }),
      shot({ id: '2', shotType: 'dji' }),
      shot({ id: '3', shotType: 'producto' }),
    ])
    expect(g.map((x) => x.key)).toEqual(['dji', 'sony', 'producto'])
  })

  it('no muestra grupos vacíos', () => {
    const g = groupShots([shot({ shotType: 'dji' })])
    expect(g).toHaveLength(1)
    expect(g[0].key).toBe('dji')
  })

  it('cuenta grabadas y pendientes por grupo', () => {
    const g = groupShots([
      shot({ id: '1', shotType: 'sony', recorded: true }),
      shot({ id: '2', shotType: 'sony', recorded: false }),
      shot({ id: '3', shotType: 'sony', recorded: true }),
    ])
    expect(g[0]).toMatchObject({ recorded: 2, pending: 1 })
  })

  it('una toma sin tipo no desaparece: cae en "Sin tipo", al final', () => {
    const g = groupShots([
      shot({ id: '1', shotType: null }),
      shot({ id: '2', shotType: 'dji' }),
    ])
    expect(g.map((x) => x.key)).toEqual(['dji', 'sin_tipo'])
  })

  it('un tipo que ya no existe en el código tampoco se pierde', () => {
    const g = groupShots([shot({ shotType: 'gopro-vieja' })])
    expect(g).toHaveLength(1)
    expect(g[0].key).toBe('sin_tipo')
  })

  it('sin tomas no hay grupos', () => {
    expect(groupShots([])).toEqual([])
  })
})

describe('progressOf', () => {
  it('cuenta total, grabadas y las que faltan', () => {
    expect(progressOf([
      shot({ id: '1', recorded: true }),
      shot({ id: '2', recorded: false }),
      shot({ id: '3', recorded: false }),
    ])).toEqual({ total: 3, recorded: 1, pending: 2, pct: 33 })
  })

  it('todo grabado es 100', () => {
    expect(progressOf([shot({ recorded: true })]).pct).toBe(100)
  })

  it('una lista vacía es 0%, no 100', () => {
    expect(progressOf([])).toEqual({ total: 0, recorded: 0, pending: 0, pct: 0 })
  })
})
