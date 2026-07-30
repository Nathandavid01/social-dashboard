import { describe, it, expect } from 'vitest'
import {
  rowIsWritten, countWritten, toPayload, withTrailingBlank, emptyIdeaRow, type IdeaRow,
} from './batch-entry'

const row = (over: Partial<IdeaRow> = {}): IdeaRow => ({ ...emptyIdeaRow(), ...over })

describe('rowIsWritten', () => {
  it('con título cuenta', () => {
    expect(rowIsWritten(row({ title: 'Tour del local' }))).toBe(true)
  })
  it('con solo "de qué es" también — titular puede venir después', () => {
    expect(rowIsWritten(row({ hook: 'El dueño explica el proceso' }))).toBe(true)
  })
  it('una fila vacía no cuenta', () => {
    expect(rowIsWritten(emptyIdeaRow())).toBe(false)
  })
  it('solo espacios tampoco', () => {
    expect(rowIsWritten(row({ title: '   ', hook: '  ' }))).toBe(false)
  })
  it('poner tipo de toma sin escribir nada no crea una idea', () => {
    expect(rowIsWritten(row({ shotType: 'dji' }))).toBe(false)
  })
})

describe('countWritten', () => {
  it('cuenta solo las escritas, ignorando la fila en blanco del final', () => {
    expect(countWritten([row({ title: 'A' }), row({ hook: 'B' }), emptyIdeaRow()])).toBe(2)
  })
})

describe('toPayload', () => {
  it('descarta las filas vacías', () => {
    expect(toPayload([row({ title: 'A' }), emptyIdeaRow()])).toHaveLength(1)
  })

  it('sin título, el "de qué es" hace de título', () => {
    const [p] = toPayload([row({ hook: 'El dueño explica el proceso' })])
    expect(p.title).toBe('El dueño explica el proceso')
    expect(p.hook).toBe('El dueño explica el proceso')
  })

  it('recorta y convierte los vacíos en null', () => {
    const [p] = toPayload([row({ title: '  Tour  ', hook: '', referenceUrl: '  ', shotType: '' })])
    expect(p).toEqual({ title: 'Tour', hook: null, contentType: 'R', shotType: null, referenceUrl: null })
  })

  it('conserva tipo de contenido y de toma', () => {
    const [p] = toPayload([row({ title: 'A', contentType: 'C', shotType: 'dji_pov' })])
    expect(p.contentType).toBe('C')
    expect(p.shotType).toBe('dji_pov')
  })

  it('sin tipo de contenido cae a Reel', () => {
    expect(toPayload([row({ title: 'A', contentType: '' })])[0].contentType).toBe('R')
  })
})

describe('withTrailingBlank', () => {
  it('deja exactamente una fila vacía al final', () => {
    const out = withTrailingBlank([row({ title: 'A' })])
    expect(out).toHaveLength(2)
    expect(rowIsWritten(out[1])).toBe(false)
  })

  it('no acumula vacías', () => {
    const out = withTrailingBlank([row({ title: 'A' }), emptyIdeaRow(), emptyIdeaRow()])
    expect(out).toHaveLength(2)
  })

  it('una tabla vacía queda con una sola fila para escribir', () => {
    expect(withTrailingBlank([])).toHaveLength(1)
  })
})
