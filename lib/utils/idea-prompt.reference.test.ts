/**
 * Contrato: el equipo pega ideas de referencia en el Idea Lab y el modelo
 * aprende de ellas. La trampa obvia es que las copie — el bloque tiene que
 * pedir explícitamente ideas NUEVAS en ese espíritu, no variaciones.
 *
 * Distinto de `approvedExamples`: eso viene del historial de la app. Esto lo
 * escribe Nathan a mano para esta generación.
 */
import { describe, it, expect } from 'vitest'
import {
  formatReferenceIdeasForPrompt,
  parseReferenceIdeas,
  buildGenerationPrompt,
  type IdeaGenInput,
} from './idea-prompt'

const base: IdeaGenInput = {
  count: 3,
  general: false,
  clientName: 'Estancias del Bosque',
  industry: 'Real estate',
  trends: [],
  typeLabels: ['Reel'],
  winners: [],
  recentTexts: [],
}

describe('parseReferenceIdeas', () => {
  it('separa por líneas y descarta las vacías', () => {
    expect(parseReferenceIdeas('Idea uno\n\n  Idea dos  \n')).toEqual(['Idea uno', 'Idea dos'])
  })

  it('quita viñetas y numeración que se pegan desde un doc', () => {
    expect(parseReferenceIdeas('- Idea uno\n2. Idea dos\n• Idea tres')).toEqual([
      'Idea uno',
      'Idea dos',
      'Idea tres',
    ])
  })

  it('devuelve vacío para entrada vacía o nula', () => {
    expect(parseReferenceIdeas('')).toEqual([])
    expect(parseReferenceIdeas(null)).toEqual([])
  })
})

describe('formatReferenceIdeasForPrompt', () => {
  it('devuelve vacío sin ideas', () => {
    expect(formatReferenceIdeasForPrompt([])).toBe('')
  })

  it('lista las ideas y prohíbe copiarlas', () => {
    const out = formatReferenceIdeasForPrompt(['Tour de la casa modelo', 'Testimonio de familia'])
    expect(out).toContain('Tour de la casa modelo')
    expect(out).toContain('Testimonio de familia')
    expect(out).toMatch(/do not (repeat|copy)/i)
  })
})

describe('buildGenerationPrompt con ideas de referencia', () => {
  it('las incluye en el prompt', () => {
    const prompt = buildGenerationPrompt({
      ...base,
      referenceIdeas: ['Tour de la casa modelo'],
    })
    expect(prompt).toContain('Tour de la casa modelo')
  })

  it('no cambia el prompt cuando no hay ninguna', () => {
    expect(buildGenerationPrompt({ ...base, referenceIdeas: [] })).toBe(buildGenerationPrompt(base))
  })
})
