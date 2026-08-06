import { describe, it, expect } from 'vitest'
import { buildFiltroIPrompt } from './prompt'

/**
 * El prompt que va a Grok junto con los frames.
 *
 * El texto de las dos tareas y el formato de salida son literales de Nathan —
 * el parser (grok-vision-core) depende de ese formato exacto, así que estos
 * tests son también el contrato entre prompt y parser.
 */
describe('buildFiltroIPrompt', () => {
  const base = {
    segmentos: [
      { inicio: 0, fin: 2.4, texto: 'Hola a todos' },
      { inicio: 2.4, fin: 5.1, texto: 'Vamos pa la playa' },
    ],
    momentos: [0, 1.2, 2.4],
  }

  it('mantiene el encargo y las dos tareas', () => {
    const p = buildFiltroIPrompt(base)
    expect(p).toContain('editor experto de contenido en español de Puerto Rico')
    expect(p).toContain('TAREA 1')
    expect(p).toContain('TAREA 2 - Caption Base')
  })

  it('mantiene la lista de tipos de error', () => {
    const p = buildFiltroIPrompt(base)
    for (const tipo of ['Ortografía', 'Acentuación', 'Puntuación', 'Transcripción', 'Nombres de marca']) {
      expect(p).toContain(tipo)
    }
  })

  it('mantiene el formato de salida exacto que espera el parser', () => {
    const p = buildFiltroIPrompt(base)
    expect(p).toContain('| Texto incorrecto | Corrección | Tipo de error | Momento aproximado |')
    expect(p).toContain('**Errores encontrados:**')
    expect(p).toContain('**Caption Base:**')
  })

  /**
   * Sin esto la comparación audio↔subtítulo no existe: el modelo solo vería
   * los subtítulos quemados y no tendría con qué compararlos.
   */
  it('inyecta la transcripción con sus tiempos', () => {
    const p = buildFiltroIPrompt(base)
    expect(p).toContain('[0.0s–2.4s] Hola a todos')
    expect(p).toContain('[2.4s–5.1s] Vamos pa la playa')
  })

  /**
   * El modelo recibe N imágenes sueltas; sin decirle a qué segundo pertenece
   * cada una no puede llenar "Momento aproximado" ni cruzar frame con audio.
   */
  it('dice a qué segundo corresponde cada frame, en orden', () => {
    const p = buildFiltroIPrompt(base)
    expect(p).toContain('0.0s, 1.2s, 2.4s')
  })

  it('sin audio lo dice explícitamente en vez de callar', () => {
    const p = buildFiltroIPrompt({ ...base, segmentos: [] })
    expect(p).toContain('(sin audio transcrito)')
  })
})
