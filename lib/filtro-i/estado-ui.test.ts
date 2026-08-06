import { describe, it, expect } from 'vitest'
import { vistaEditor, EN_VUELO, sinAudio } from './estado-ui'

/**
 * Un fallo de transcripción NO mata el análisis.
 *
 * Grok puede revisar ortografía, tildes y puntuación mirando solo los frames;
 * lo único que se pierde sin audio es la comparación contra lo que se escucha.
 * Tirar el análisis entero por eso dejaría al editor sin la revisión que sí se
 * podía hacer — y un video mudo caería en el mismo agujero.
 *
 * Pero tiene que DECIRSE. Una tabla que salió sin oír el audio parece completa
 * y no lo es, y esa es la forma más fácil de que se cuele un subtítulo que dice
 * otra cosa de la que se dijo.
 */
describe('sinAudio', () => {
  it('avisa cuando la transcripción falló pero el análisis siguió', () => {
    expect(sinAudio('listo', 'transcribir')).toBe(true)
    expect(sinAudio('redactando', 'transcribir')).toBe(true)
  })

  it('no avisa cuando hubo audio', () => {
    expect(sinAudio('listo', null)).toBe(false)
  })

  /** Si el análisis murió, lo que manda es el error, no el aviso. */
  it('no avisa cuando el análisis falló del todo', () => {
    expect(sinAudio('error', 'transcribir')).toBe(false)
  })

  /** Un fallo viejo en otro paso no es un aviso de audio. */
  it('un fallo de otro paso no se confunde con falta de audio', () => {
    expect(sinAudio('listo', 'analizar')).toBe(false)
  })
})

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
