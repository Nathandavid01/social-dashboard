import { describe, it, expect } from 'vitest'
import { siguientePaso, ESTADO_POR_PASO } from './pasos'

/**
 * Qué le falta a un análisis. Puro para poder probar el reanudado sin base de
 * datos ni APIs.
 *
 * La regla que sostiene todo: se mira lo que YA está guardado, no el `status`.
 * Si un reintento se fiara del status, un proceso muerto a mitad de la llamada
 * de visión se quedaría en 'analizando' para siempre; mirando los datos, el
 * reintento ve que la transcripción está y no la vuelve a pagar.
 */
describe('siguientePaso', () => {
  const vacio = { transcripcion: null, caption_base: null, caption_final: null }

  it('sin nada, empieza por transcribir', () => {
    expect(siguientePaso(vacio)).toBe('transcribir')
  })

  it('con la transcripción hecha, toca el análisis visual', () => {
    expect(siguientePaso({ ...vacio, transcripcion: [] })).toBe('analizar')
  })

  it('con el caption base, toca redactar el final', () => {
    expect(siguientePaso({ ...vacio, transcripcion: [], caption_base: 'algo' })).toBe('redactar')
  })

  it('con todo hecho no queda paso', () => {
    expect(
      siguientePaso({ transcripcion: [], caption_base: 'algo', caption_final: 'final' }),
    ).toBeNull()
  })

  /**
   * Un video mudo transcribe a lista vacía. Eso es un resultado válido, no un
   * hueco: si se tratara como "falta", el análisis se quedaría reintentando la
   * transcripción para siempre.
   */
  it('una transcripción vacía cuenta como hecha', () => {
    expect(siguientePaso({ ...vacio, transcripcion: [] })).not.toBe('transcribir')
  })

  /**
   * Grok puede no devolver caption base (video sin mensaje claro). Reintentar
   * la visión en bucle costaría dinero sin arreglar nada, así que un análisis
   * con errores ya guardados se da por hecho aunque el caption venga vacío.
   */
  it('con errores guardados y sin caption base, no repite la visión', () => {
    expect(siguientePaso({ ...vacio, transcripcion: [], errores: [] })).toBe('redactar')
  })

  it('cada paso sabe qué estado enseñar mientras corre', () => {
    expect(ESTADO_POR_PASO.transcribir).toBe('transcribiendo')
    expect(ESTADO_POR_PASO.analizar).toBe('analizando')
    expect(ESTADO_POR_PASO.redactar).toBe('redactando')
  })
})
