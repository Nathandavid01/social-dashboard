import { describe, it, expect } from 'vitest'
import { diaDeFecha, proximaFechaDelDia, etiquetaDia, DIAS } from './dias'

describe('DIAS', () => {
  it('va de lunes a sábado, sin domingo', () => {
    expect(DIAS.map((d) => d.label)).toEqual([
      'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
    ])
  })
})

describe('diaDeFecha', () => {
  // 2026-07-27 es lunes.
  it('saca el día de la semana de una fecha', () => {
    expect(diaDeFecha('2026-07-27')).toBe(1) // lunes
    expect(diaDeFecha('2026-07-28')).toBe(2) // martes
    expect(diaDeFecha('2026-08-01')).toBe(6) // sábado
  })

  it('el domingo queda fuera de la operación', () => {
    expect(diaDeFecha('2026-08-02')).toBeNull()
  })

  it('sin fecha no hay día', () => {
    expect(diaDeFecha(null)).toBeNull()
    expect(diaDeFecha(undefined)).toBeNull()
    expect(diaDeFecha('')).toBeNull()
  })

  it('una fecha malformada no revienta', () => {
    expect(diaDeFecha('no-es-fecha')).toBeNull()
  })
})

describe('proximaFechaDelDia', () => {
  const lunes = new Date(2026, 6, 27, 10) // lunes 27 jul 2026

  it('entregar para hoy significa HOY, no la semana que viene', () => {
    expect(proximaFechaDelDia(1, lunes)).toBe('2026-07-27')
  })

  it('un día posterior de la misma semana', () => {
    expect(proximaFechaDelDia(3, lunes)).toBe('2026-07-29') // miércoles
    expect(proximaFechaDelDia(6, lunes)).toBe('2026-08-01') // sábado
  })

  it('un día ya pasado salta a la semana siguiente', () => {
    const jueves = new Date(2026, 6, 30, 10)
    expect(proximaFechaDelDia(1, jueves)).toBe('2026-08-03') // el lunes que viene
  })

  it('cruza de mes sin romperse', () => {
    const viernes = new Date(2026, 6, 31, 10) // 31 jul
    expect(proximaFechaDelDia(6, viernes)).toBe('2026-08-01')
  })

  it('lo que devuelve vuelve a leerse como el mismo día', () => {
    for (const d of DIAS) {
      expect(diaDeFecha(proximaFechaDelDia(d.key, lunes))).toBe(d.key)
    }
  })
})

describe('etiquetaDia', () => {
  it('nombra el día, y lo vacío es "Sin día"', () => {
    expect(etiquetaDia(1)).toBe('Lunes')
    expect(etiquetaDia(null)).toBe('Sin día')
  })
})
