import { describe, it, expect } from 'vitest'
import { buildGraphicPrompt } from './graphic-prompt'

const base = {
  concept: 'Promo 2x1 en cortes de pelo este fin de semana',
  clientName: 'Barbería El Jefe',
  industry: 'barbershop',
  brandVoice: 'cercano y confiado',
  captionLanguage: 'spanish',
  brandColors: { primary: '#C9A227', secondary: '#111111', accent: null, text: '#FFFFFF' },
  captionNotes: 'nunca usar morado',
}

describe('buildGraphicPrompt', () => {
  it('includes the concept, client name and industry', () => {
    const p = buildGraphicPrompt(base)
    expect(p).toContain('Promo 2x1 en cortes de pelo este fin de semana')
    expect(p).toContain('Barbería El Jefe')
    expect(p).toContain('barbershop')
  })

  it('passes the brand colors that are set and skips empty ones', () => {
    const p = buildGraphicPrompt(base)
    expect(p).toContain('#C9A227')
    expect(p).toContain('#111111')
    expect(p).toContain('#FFFFFF')
    expect(p).not.toContain('accent')
  })

  it('instructs Spanish text by default and English when asked', () => {
    expect(buildGraphicPrompt(base)).toMatch(/in Spanish/)
    expect(buildGraphicPrompt({ ...base, captionLanguage: 'english' })).toMatch(/in English/)
  })

  it('omits brand sections that have no data', () => {
    const p = buildGraphicPrompt({ concept: 'algo', clientName: 'X' })
    expect(p).toContain('algo')
    expect(p).not.toContain('Brand colors')
    expect(p).not.toContain('Brand voice')
    expect(p).not.toContain('Extra brand notes')
  })

  it('includes the caption notes as brand guidance', () => {
    expect(buildGraphicPrompt(base)).toContain('nunca usar morado')
  })

  it('includes brand fonts when set and omits the section otherwise', () => {
    const p = buildGraphicPrompt({
      ...base,
      brandFonts: { primary: 'Montserrat Bold', secondary: 'Lato' },
    })
    expect(p).toContain('Montserrat Bold')
    expect(p).toContain('Lato')
    expect(p).toMatch(/typography/i)
    expect(buildGraphicPrompt(base)).not.toContain('Montserrat')
    expect(buildGraphicPrompt({ ...base, brandFonts: { primary: null, secondary: '' } })).not.toContain(
      'Brand typography',
    )
  })

  it('always demands a professional social-media design with no fake logos', () => {
    const p = buildGraphicPrompt(base)
    expect(p.toLowerCase()).toContain('social media')
    expect(p.toLowerCase()).toContain('do not invent or draw any logo')
  })

  it('fromPhoto switches to transforming the provided photo and keeps its subject', () => {
    const p = buildGraphicPrompt({ ...base, fromPhoto: true })
    expect(p).toMatch(/provided photo/i)
    expect(p).toMatch(/subject .* recognizable/i)
    // Brand context still travels with the photo instructions
    expect(p).toContain('#C9A227')
    expect(p).toContain('Barbería El Jefe')
    // The pure text-to-image opening is replaced, not duplicated
    expect(p).not.toContain('Design a polished social media graphic')
  })
})
