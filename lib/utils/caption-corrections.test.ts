import { describe, it, expect } from 'vitest'
import { huboCambioSignificativo, seleccionarCorrecciones } from './caption-corrections'

describe('huboCambioSignificativo', () => {
  it('false si el texto es idéntico', () => {
    expect(huboCambioSignificativo('Un caption cualquiera', 'Un caption cualquiera')).toBe(false)
  })

  it('false si solo cambia el espaciado o mayúsculas (ruido, no aprendizaje)', () => {
    expect(huboCambioSignificativo('Un   caption  cualquiera', 'un caption cualquiera')).toBe(false)
    expect(
      huboCambioSignificativo('  Un caption con espacios raros  \n\n', 'Un caption con espacios raros'),
    ).toBe(false)
  })

  it('true si el equipo cambió palabras de verdad', () => {
    expect(huboCambioSignificativo('Compra ya el combo', 'Reserva hoy el combo especial')).toBe(true)
  })

  it('true si el borrador quedó vacío/null y el final tiene texto (fallback raro, cuenta como corrección)', () => {
    expect(huboCambioSignificativo(null, 'Caption final escrito por el equipo')).toBe(true)
    expect(huboCambioSignificativo('', 'Caption final escrito por el equipo')).toBe(true)
  })

  it('false si ambos están vacíos', () => {
    expect(huboCambioSignificativo(null, '')).toBe(false)
    expect(huboCambioSignificativo('', '   ')).toBe(false)
  })
})

describe('seleccionarCorrecciones', () => {
  const row = (draft: string, final: string, recency: string) => ({ draftText: draft, finalText: final, recency })

  it('devuelve las más recientes primero, hasta el límite', () => {
    const rows = [
      row('a1', 'a2', '2026-01-01'),
      row('b1', 'b2', '2026-03-01'),
      row('c1', 'c2', '2026-02-01'),
    ]
    const out = seleccionarCorrecciones(rows, 2)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ draft: 'b1', final: 'b2' })
    expect(out[1]).toEqual({ draft: 'c1', final: 'c2' })
  })

  it('descarta filas sin texto final', () => {
    const rows = [row('a1', '', '2026-01-01'), row('b1', 'b2', '2026-02-01')]
    expect(seleccionarCorrecciones(rows)).toEqual([{ draft: 'b1', final: 'b2' }])
  })

  it('trunca textos largos para no inflar el prompt', () => {
    const largo = 'x'.repeat(400)
    const out = seleccionarCorrecciones([row(largo, largo, '2026-01-01')], 5, 50)
    expect(out[0].draft.length).toBe(51) // 50 + '…'
    expect(out[0].draft.endsWith('…')).toBe(true)
    expect(out[0].final.endsWith('…')).toBe(true)
  })

  it('con lista vacía devuelve vacío', () => {
    expect(seleccionarCorrecciones([])).toEqual([])
  })
})
