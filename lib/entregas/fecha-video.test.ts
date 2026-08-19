import { describe, it, expect } from 'vitest'
import { checkFechaVideo, etiquetaFechaVideo } from './fecha-video'

// lunes 2026-08-03
const HOY = new Date(2026, 7, 3)

describe('checkFechaVideo', () => {
  it('sin fecha no se puede entregar: es el dato que decide todo lo demás', () => {
    expect(checkFechaVideo('', HOY).ok).toBe(false)
  })

  it('una fecha válida pasa', () => {
    expect(checkFechaVideo('2026-08-05', HOY).ok).toBe(true)
  })

  it('hoy vale', () => {
    expect(checkFechaVideo('2026-08-03', HOY).ok).toBe(true)
  })

  /**
   * Una fecha pasada no se rechaza: puede ser trabajo atrasado que se entrega
   * tarde a propósito, y bloquearlo obligaría a inventarse una fecha falsa. Se
   * avisa y ya.
   */
  it('una fecha pasada avisa pero deja seguir', () => {
    const r = checkFechaVideo('2026-07-20', HOY)
    expect(r.ok).toBe(true)
    expect(r.aviso).toMatch(/pasad/i)
  })

  it('avisa si el día no está en los posting_days del cliente', () => {
    // 2026-08-04 es martes; el cliente publica lun/mié/vie
    const r = checkFechaVideo('2026-08-04', HOY, [1, 3, 5])
    expect(r.ok).toBe(true)
    expect(r.aviso).toMatch(/no publica/i)
  })

  it('no avisa cuando la fecha cae en un día de posting', () => {
    expect(checkFechaVideo('2026-08-05', HOY, [1, 3, 5]).aviso).toBeNull()
  })

  it('una fecha de hoy o futura no avisa', () => {
    expect(checkFechaVideo('2026-08-03', HOY).aviso).toBeNull()
    expect(checkFechaVideo('2026-08-20', HOY).aviso).toBeNull()
  })

  it('una fecha absurda no pasa', () => {
    expect(checkFechaVideo('no-es-fecha', HOY).ok).toBe(false)
  })
})

describe('etiquetaFechaVideo', () => {
  it('dice el día de la semana, que es lo que se piensa al planificar', () => {
    expect(etiquetaFechaVideo('2026-08-05')).toMatch(/mi[ée]rcoles/i)
  })

  it('sin fecha no inventa nada', () => {
    expect(etiquetaFechaVideo('')).toBe('')
  })
})
