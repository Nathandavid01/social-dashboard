import { describe, it, expect } from 'vitest'
import { buildIdeaCaptionPrompt } from './idea-caption-prompt'

/**
 * `captionBase` — lo que Filtro I averigua del video YA EDITADO: lo que
 * realmente se dice (transcrito) y se ve.
 *
 * Se añade a este builder en vez de escribir uno nuevo porque este es el
 * agente de captions de verdad: trae el historial de Metricool, los captions
 * que el equipo aprobó y los que rechazó. Duplicarlo habría dado dos estilos
 * distintos para el mismo cliente.
 *
 * Campo opcional: los tres llamadores que ya existen (idea-captions,
 * idea-lab-captions) no pasan nada y su prompt no cambia.
 */
describe('buildIdeaCaptionPrompt con captionBase', () => {
  const base = { title: 'Reel de la sucursal', examples: [] }

  it('mete el contenido real del video en la idea', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      captionBase: 'El equipo recorre la sucursal nueva y explica los servicios.',
    })
    expect(p).toContain('El equipo recorre la sucursal nueva y explica los servicios.')
  })

  /**
   * El brief es una intención escrita ANTES de grabar; el caption base es lo
   * que acabó pasando. Cuando difieren manda el video, y el prompt lo tiene que
   * decir o el modelo escribirá sobre lo que se planeó, no sobre lo que se grabó.
   */
  it('deja claro que pesa más que el brief', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      visualBrief: 'grabar la fachada',
      captionBase: 'Acabaron grabando el interior con el equipo completo.',
    })
    const iBrief = p.indexOf('grabar la fachada')
    const iReal = p.indexOf('Acabaron grabando el interior')
    expect(iBrief).toBeGreaterThanOrEqual(0)
    expect(iReal).toBeGreaterThan(iBrief)
    expect(p).toMatch(/manda lo que dice el video|prevalece|por encima del brief/i)
  })

  it('sin captionBase el prompt no cambia', () => {
    const conNada = buildIdeaCaptionPrompt(base)
    const conVacio = buildIdeaCaptionPrompt({ ...base, captionBase: '   ' })
    const conNull = buildIdeaCaptionPrompt({ ...base, captionBase: null })
    expect(conVacio).toBe(conNada)
    expect(conNull).toBe(conNada)
  })

  it('sigue trayendo el historial del cliente', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      captionBase: 'Contenido real.',
      examples: [{ text: 'Caption viejo 🔥', provider: 'instagram' }],
      approvedExamples: ['Caption que el equipo aprobó'],
    })
    expect(p).toContain('Caption viejo 🔥')
    expect(p).toContain('Caption que el equipo aprobó')
  })
})
