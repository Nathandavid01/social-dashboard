import { describe, it, expect } from 'vitest'
import { momentosDeMuestreo, INTERVALO_SEG, MAX_FRAMES } from './frames'

/**
 * Qué segundos del video se capturan como frame.
 *
 * Dos reglas que no son negociables: nunca más de MAX_FRAMES (cada frame es una
 * imagen que se paga en la llamada de visión) y nunca se pierde el final del
 * video — en un video largo se estira el intervalo, no se corta la cola.
 */
describe('momentosDeMuestreo', () => {
  it('muestrea cada 1.2s en un video corto', () => {
    expect(momentosDeMuestreo(12)).toEqual([
      0, 1.2, 2.4, 3.6, 4.8, 6, 7.2, 8.4, 9.6, 10.8,
    ])
  })

  it('nunca pasa del tope de frames', () => {
    // 60s a 1.2s serían 50 frames.
    const m = momentosDeMuestreo(60)
    expect(m).toHaveLength(MAX_FRAMES)
  })

  /**
   * El bug obvio sería cortar en el frame 24 y perder el segundo 30 en
   * adelante. Los errores de subtítulo del final son tan reales como los del
   * principio, así que se estira el intervalo y se cubre el video entero.
   */
  it('en un video largo estira el intervalo en vez de cortar el final', () => {
    const m = momentosDeMuestreo(120)
    expect(m).toHaveLength(MAX_FRAMES)
    expect(m[0]).toBe(0)
    // El último frame vive en el último tramo del video, no en el segundo 28.
    expect(m[m.length - 1]).toBeGreaterThan(110)
    expect(m[m.length - 1]).toBeLessThan(120)
  })

  it('ningún momento cae fuera del video', () => {
    for (const dur of [3, 12, 45, 200]) {
      for (const t of momentosDeMuestreo(dur)) {
        expect(t).toBeGreaterThanOrEqual(0)
        expect(t).toBeLessThan(dur)
      }
    }
  })

  it('va en orden y sin repetidos', () => {
    const m = momentosDeMuestreo(75)
    expect([...m].sort((a, b) => a - b)).toEqual(m)
    expect(new Set(m).size).toBe(m.length)
  })

  it('un video muy corto da al menos un frame', () => {
    expect(momentosDeMuestreo(0.5)).toEqual([0])
  })

  // Un <video> que aún no cargó metadata da duration NaN o Infinity. Devolver
  // [] deja que el llamador avise, en vez de reventar en un bucle infinito.
  it('sin duración usable devuelve vacío', () => {
    expect(momentosDeMuestreo(0)).toEqual([])
    expect(momentosDeMuestreo(-5)).toEqual([])
    expect(momentosDeMuestreo(NaN)).toEqual([])
    expect(momentosDeMuestreo(Infinity)).toEqual([])
  })

  it('acepta intervalo y tope a medida', () => {
    expect(momentosDeMuestreo(10, { intervalo: 2 })).toEqual([0, 2, 4, 6, 8])
    expect(momentosDeMuestreo(100, { tope: 5 })).toHaveLength(5)
  })

  it('redondea a 2 decimales para no arrastrar ruido de coma flotante', () => {
    for (const t of momentosDeMuestreo(37)) {
      expect(t).toBe(Number(t.toFixed(2)))
    }
  })

  it('los valores por defecto son los del producto', () => {
    expect(INTERVALO_SEG).toBe(1.2)
    expect(MAX_FRAMES).toBe(24)
  })
})
