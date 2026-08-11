import { describe, it, expect } from 'vitest'
import { emptyIdeaRow, type IdeaRow } from './batch-entry'
import { hayTrabajoSinEnviar, rowsDesdeBorrador, rowsParaBorrador } from './draft'

/**
 * El borrador existe porque cambiar de cliente con ideas a medio escribir se
 * llevaba el trabajo por delante — y peor: lo guardaba en el cliente
 * equivocado. Reglas de qué se persiste y cuándo hay que avisar.
 */

const conTitulo = (title: string): IdeaRow => ({ ...emptyIdeaRow(), title })

describe('hayTrabajoSinEnviar', () => {
  it('no avisa con la tabla recién abierta', () => {
    expect(hayTrabajoSinEnviar([emptyIdeaRow()])).toBe(false)
  })

  it('no avisa cuando solo hay filas en blanco', () => {
    expect(hayTrabajoSinEnviar([emptyIdeaRow(), emptyIdeaRow()])).toBe(false)
  })

  it('avisa en cuanto hay una idea escrita', () => {
    expect(hayTrabajoSinEnviar([conTitulo('Reel del café'), emptyIdeaRow()])).toBe(true)
  })

  // Escribir solo "de qué es" ya es trabajo: el título puede venir después.
  it('avisa aunque solo esté el "de qué es"', () => {
    expect(hayTrabajoSinEnviar([{ ...emptyIdeaRow(), hook: 'entrada del local' }])).toBe(true)
  })

  it('los espacios no cuentan como trabajo', () => {
    expect(hayTrabajoSinEnviar([conTitulo('   ')])).toBe(false)
  })
})

describe('rowsParaBorrador', () => {
  it('guarda solo las filas escritas — la vacía del final no se persiste', () => {
    const rows = [conTitulo('Uno'), emptyIdeaRow()]
    expect(rowsParaBorrador(rows)).toEqual([conTitulo('Uno')])
  })

  it('sin nada escrito, el borrador queda vacío (así se borra en el servidor)', () => {
    expect(rowsParaBorrador([emptyIdeaRow()])).toEqual([])
  })
})

describe('rowsDesdeBorrador', () => {
  it('reabre el borrador con su fila vacía al final para seguir tecleando', () => {
    const rows = rowsDesdeBorrador([conTitulo('Uno')])
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toBe('Uno')
    expect(rows[1]).toEqual(emptyIdeaRow())
  })

  it('un borrador vacío o ausente abre la tabla en blanco', () => {
    expect(rowsDesdeBorrador([])).toEqual([emptyIdeaRow()])
    expect(rowsDesdeBorrador(null)).toEqual([emptyIdeaRow()])
  })

  // El borrador viene de la base: puede traer basura de una versión vieja.
  it('descarta filas que no tienen forma de idea', () => {
    const sucio = [{ title: 'Buena' }, null, 'texto suelto', { nada: 1 }] as unknown as IdeaRow[]
    const rows = rowsDesdeBorrador(sucio)
    expect(rows.map((r) => r.title)).toEqual(['Buena', ''])
    expect(rows[0].contentType).toBe('R') // completa lo que falte con los valores por defecto
  })
})
