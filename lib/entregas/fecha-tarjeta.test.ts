import { describe, it, expect } from 'vitest'
import { fechaTarjeta } from './fecha-tarjeta'

/**
 * La tarjeta tiene que decir su fecha.
 *
 * El tablero mete lo atrasado en la semana en curso, así que la pestaña "Lunes"
 * enseña a la vez el video del 3 y el del 10. Sin la fecha escrita en la
 * tarjeta no hay forma de distinguirlos —que es literalmente lo que el equipo
 * reportó como "los videos se están cruzando".
 */

// Martes 11 de agosto de 2026, a mediodía.
const HOY = new Date(2026, 7, 11, 12)

describe('fechaTarjeta', () => {
  it('etiqueta la fecha con su día de la semana', () => {
    const f = fechaTarjeta('2026-08-11', HOY)
    expect(f.etiqueta).toBe('mar 11 ago')
  })

  it('marca hoy como hoy', () => {
    const f = fechaTarjeta('2026-08-11', HOY)
    expect(f.estado).toBe('hoy')
    expect(f.aviso).toBeNull()
  })

  it('una fecha futura de esta misma semana no lleva aviso', () => {
    const f = fechaTarjeta('2026-08-14', HOY)
    expect(f.estado).toBe('proxima')
    expect(f.aviso).toBeNull()
  })

  it('una fecha ya pasada se marca como atrasada y lo dice', () => {
    const f = fechaTarjeta('2026-08-03', HOY)
    expect(f.estado).toBe('atrasada')
    // El aviso tiene que nombrar la fecha: es lo que delata al video que se
    // coló en la pestaña de esta semana.
    expect(f.aviso).toContain('lun 3 ago')
  })

  it('el día anterior ya cuenta como atrasado', () => {
    const f = fechaTarjeta('2026-08-10', HOY)
    expect(f.estado).toBe('atrasada')
  })

  it('una fecha de una semana posterior se avisa como otra semana', () => {
    // Lunes 17: semana siguiente.
    const f = fechaTarjeta('2026-08-17', HOY)
    expect(f.estado).toBe('otra-semana')
    expect(f.aviso?.toLowerCase()).toContain('semana')
  })

  it('el domingo cierra la semana, no la abre', () => {
    // Domingo 16 es todavía ESTA semana (lunes 10 → domingo 16).
    const f = fechaTarjeta('2026-08-16', HOY)
    expect(f.estado).toBe('proxima')
  })

  it('sin fecha lo dice en vez de inventarse una', () => {
    const f = fechaTarjeta(null, HOY)
    expect(f.estado).toBe('sin-fecha')
    expect(f.etiqueta).toBe('Sin fecha')
    expect(f.iso).toBeNull()
  })

  it('una fecha basura se trata como sin fecha, no revienta', () => {
    expect(fechaTarjeta('', HOY).estado).toBe('sin-fecha')
    expect(fechaTarjeta('no-es-fecha', HOY).estado).toBe('sin-fecha')
  })

  it('no se corre de día por la zona horaria', () => {
    // Construir a medianoche caería en el día anterior en Puerto Rico (UTC-4),
    // y entonces un lunes se enseñaría como domingo.
    expect(fechaTarjeta('2026-08-03', HOY).etiqueta).toBe('lun 3 ago')
    expect(fechaTarjeta('2026-01-01', HOY).etiqueta).toBe('jue 1 ene')
  })

  it('conserva el iso original para poder compararlo', () => {
    expect(fechaTarjeta('2026-08-03', HOY).iso).toBe('2026-08-03')
  })
})
