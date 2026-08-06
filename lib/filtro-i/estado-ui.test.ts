import { describe, it, expect } from 'vitest'
import { vistaEditor, EN_VUELO } from './estado-ui'

/**
 * Cómo se le enseña el estado AL EDITOR.
 *
 * El editor no ve el caption, así que tampoco puede ver "redactando el
 * caption": eso le contaría que existe un caption y dónde está en el proceso.
 * Para él, en cuanto la tabla de errores está guardada, esto terminó.
 */
describe('vistaEditor', () => {
  it('mientras transcribe y analiza, lo dice sin nombrar el caption', () => {
    expect(vistaEditor('pendiente').etiqueta).toBe('En cola')
    expect(vistaEditor('transcribiendo').etiqueta).toBe('Escuchando el audio')
    expect(vistaEditor('analizando').etiqueta).toBe('Revisando el video')
  })

  /**
   * En 'redactando' la tabla de errores YA está guardada; lo que sigue es el
   * caption, que no es asunto suyo. Así que para el editor está listo.
   */
  it('redactando se le enseña como listo', () => {
    expect(vistaEditor('redactando').etiqueta).toBe('Listo')
    expect(vistaEditor('listo').etiqueta).toBe('Listo')
  })

  it('ningún estado le menciona el caption', () => {
    for (const s of ['pendiente', 'transcribiendo', 'analizando', 'redactando', 'listo', 'error'] as const) {
      expect(vistaEditor(s).etiqueta.toLowerCase()).not.toContain('caption')
    }
  })

  it('el error se ve como error', () => {
    expect(vistaEditor('error').etiqueta).toBe('Falló')
    expect(vistaEditor('error').fallo).toBe(true)
  })

  it('sabe cuándo ya no hace falta seguir consultando', () => {
    expect(vistaEditor('redactando').terminado).toBe(true)
    expect(vistaEditor('listo').terminado).toBe(true)
    expect(vistaEditor('error').terminado).toBe(true)
    expect(vistaEditor('analizando').terminado).toBe(false)
  })

  it('EN_VUELO son exactamente los estados que siguen trabajando', () => {
    expect(Array.from(EN_VUELO).sort()).toEqual(['analizando', 'pendiente', 'transcribiendo'])
  })
})
