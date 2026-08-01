import { describe, it, expect } from 'vitest'
import { marcaAprobacionCliente, type EstadoCliente } from './marca-cliente'

const e = (...xs: EstadoCliente[]) => xs

describe('marcaAprobacionCliente', () => {
  it('sin enlace enviado no hay marca', () => {
    expect(marcaAprobacionCliente([], 'copy')).toBeNull()
  })

  it('enviado pero sin responder tampoco: todavía no hay nada que celebrar', () => {
    expect(marcaAprobacionCliente(e('pending', 'pending'), 'copy')).toBeNull()
  })

  /**
   * El caso que motivó esto: el cliente puede aprobar antes de que el copy
   * exista. La tarjeta se queda en Copy —eso ya funcionaba— pero no lo decía.
   */
  it('todo aprobado y en Copy: dice que falta el copy', () => {
    const m = marcaAprobacionCliente(e('approved', 'approved'), 'copy')
    expect(m?.label).toBe('Aprobado por el cliente · falta el copy')
    expect(m?.tone).toBe('ok')
  })

  it('todo aprobado y ya en Publicación: la marca viaja con la tarjeta', () => {
    const m = marcaAprobacionCliente(e('approved'), 'publication')
    expect(m?.label).toBe('Aprobado por el cliente')
    expect(m?.tone).toBe('ok')
  })

  it('aprobado a medias dice cuántos van', () => {
    const m = marcaAprobacionCliente(e('approved', 'pending', 'pending'), 'copy')
    expect(m?.label).toBe('1 de 3 aprobados por el cliente')
    expect(m?.tone).toBe('parcial')
  })

  // Un rechazo manda sobre todo lo demás: hay trabajo que rehacer.
  it('si alguno fue rechazado, eso es lo que se dice', () => {
    const m = marcaAprobacionCliente(e('approved', 'rejected'), 'copy')
    expect(m?.label).toBe('El cliente pidió cambios en 1')
    expect(m?.tone).toBe('cambios')
  })

  it('varios rechazados se cuentan', () => {
    expect(marcaAprobacionCliente(e('rejected', 'rejected'), 'copy')?.label)
      .toBe('El cliente pidió cambios en 2')
  })

  it('en Editado y Revisión no se enseña: ahí la tarjeta ya trae su propia caja', () => {
    expect(marcaAprobacionCliente(e('approved'), 'edited')).toBeNull()
    expect(marcaAprobacionCliente(e('approved'), 'approval')).toBeNull()
  })
})
