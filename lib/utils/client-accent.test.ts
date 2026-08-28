import { describe, it, expect } from 'vitest'
import { clientAccent, clientCardColor } from './client-accent'

describe('clientAccent', () => {
  it('is stable for the same id', () => {
    expect(clientAccent('abc')).toBe(clientAccent('abc'))
  })
  it('returns a usable accent with a fallback for null', () => {
    const a = clientAccent(null)
    expect(a.dot).toMatch(/^#/)
    expect(a.text).toMatch(/^#/)
    expect(a.soft).toContain('rgba')
  })
  it('spreads different ids across the palette', () => {
    const dots = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => clientAccent(id).dot))
    expect(dots.size).toBeGreaterThan(1)
  })
})

describe('clientCardColor', () => {
  it('mismo client_id → el mismo color (Speedy Net no cambia al recargar)', () => {
    const a = clientCardColor({ id: 'speedy-net-id' })
    const b = clientCardColor({ id: 'speedy-net-id' })
    expect(a.dot).toBe(b.dot)
    expect(a.dot).toMatch(/^#/)
  })

  it('usa brand_colors.primary cuando es un hex válido', () => {
    const color = clientCardColor({
      id: 'speedy-net-id',
      brand_colors: { primary: '#E11D48' },
    })
    expect(color.dot.toUpperCase()).toBe('#E11D48')
  })

  it('usa brandColor suelto si viene del mapa de la página', () => {
    expect(clientCardColor({ id: 'x', brandColor: '#0ea5e9' }).dot.toLowerCase()).toBe('#0ea5e9')
  })

  it('hex inválido cae al hash estable del id', () => {
    const hashed = clientCardColor({ id: 'speedy-net-id' })
    expect(clientCardColor({ id: 'speedy-net-id', brandColor: 'not-a-color' }).dot).toBe(hashed.dot)
  })
})
