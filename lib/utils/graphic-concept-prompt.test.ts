import { describe, it, expect } from 'vitest'
import { buildConceptEnhancePrompt } from './graphic-concept-prompt'

const base = {
  concept: 'promo 2x1 cortes fin de semana',
  clientName: 'Barbería El Jefe',
  industry: 'barbershop',
  brandVoice: 'cercano y confiado',
  captionNotes: 'nunca usar morado',
}

describe('buildConceptEnhancePrompt', () => {
  it('includes the rough concept and the client context', () => {
    const p = buildConceptEnhancePrompt(base)
    expect(p).toContain('promo 2x1 cortes fin de semana')
    expect(p).toContain('Barbería El Jefe')
    expect(p).toContain('barbershop')
    expect(p).toContain('cercano y confiado')
    expect(p).toContain('nunca usar morado')
  })

  it('demands Spanish output, exact overlay text in quotes, and nothing but the description', () => {
    const p = buildConceptEnhancePrompt(base)
    expect(p).toMatch(/in Spanish/)
    expect(p.toLowerCase()).toContain('quotes')
    expect(p.toLowerCase()).toContain('only the improved description')
  })

  it('asks to describe the attached photo when hasPhoto', () => {
    expect(buildConceptEnhancePrompt({ ...base, hasPhoto: true })).toMatch(/attached photo/i)
    expect(buildConceptEnhancePrompt(base)).not.toMatch(/attached photo/i)
  })

  it('omits empty client fields gracefully', () => {
    const p = buildConceptEnhancePrompt({ concept: 'algo', clientName: 'X' })
    expect(p).toContain('algo')
    expect(p).not.toContain('Brand voice')
    expect(p).not.toContain('Agency notes')
  })
})
