import { describe, it, expect } from 'vitest'
import {
  rowIsWritten, rowHasDraftContent, countWritten, toPayload, withTrailingBlank, emptyIdeaRow, type IdeaRow,
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
  it('poner solo objetivo/embudo sin título ni hook no crea una idea', () => {
    expect(rowIsWritten(row({ objective: 'Conversion', funnelStage: 'BOFU' }))).toBe(false)
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
    const [p] = toPayload([row({ title: '  Tour  ', hook: '', referenceUrl: '  ', shotType: '', objective: '', funnelStage: '' })])
    expect(p).toEqual({
      title: 'Tour',
      objective: null,
      funnelStage: null,
      hook: null,
      contentType: 'R',
      shotType: null,
      referenceUrl: null,
    })
  })

  it('incluye objective y funnel_stage cuando el escritor los rellena', () => {
    const [p] = toPayload([row({
      title: 'Tour',
      objective: '  Aumentar reservas  ',
      funnelStage: 'BOFU',
    })])
    expect(p.objective).toBe('Aumentar reservas')
    expect(p.funnelStage).toBe('BOFU')
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

describe('rowHasDraftContent / withTrailingBlank con objetivo', () => {
  it('conserva una fila que solo tiene objetivo mientras se escribe', () => {
    const out = withTrailingBlank([row({ objective: 'Conversion' })])
    expect(out).toHaveLength(2)
    expect(out[0].objective).toBe('Conversion')
    expect(rowIsWritten(out[0])).toBe(false)
    expect(rowHasDraftContent(out[0])).toBe(true)
  })
})
