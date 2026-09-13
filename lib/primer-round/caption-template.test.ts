import { describe, it, expect } from 'vitest'
import {
  buildPrimerRoundCaption,
  buildPrimerRoundCaptionPromptInstructions,
  checkPrimerRoundCaptionStructure,
  checkPrimerRoundOverlayStructure,
  PRIMER_ROUND_HASHTAGS,
  PRIMER_ROUND_ATTRIBUTION_PHRASE,
  PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON,
} from './caption-template'
import { captionSurfaceFromText, overlayFromBurnedCaptions } from './orthography'
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'

describe('Primer Round locked caption template', () => {
  it('builds the Exact IG skeleton Eric locked', () => {
    const caption = buildPrimerRoundCaption({
      hook: '¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?',
      guest: 'Exfiscal Zulma Fúster',
    })
    expect(caption).toBe(
      [
        '¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?',
        '',
        `Exfiscal Zulma Fúster ${PRIMER_ROUND_ATTRIBUTION_PHRASE}`,
        '',
        PRIMER_ROUND_HASHTAGS,
      ].join('\n'),
    )
    expect(checkPrimerRoundCaptionStructure(caption)).toEqual([])
  })

  it('optionally includes the YouTube Magic Tv line', () => {
    const caption = buildPrimerRoundCaption({
      hook: 'Tema del día',
      guest: 'Lcdo. Edwin Barreto',
      includeYoutube: true,
    })
    expect(caption).toContain('Episodio completo en nuestro canal de YouTube: Magic Tv')
    expect(checkPrimerRoundCaptionStructure(caption)).toEqual([])
  })

  it('flags @handles and wrong hashtags in caption', () => {
    const bad = [
      'Hook',
      '',
      'Guest hoy en Primer Round junto a @denniseyperez y @rafaellenin.',
      '',
      '#otro #tag',
    ].join('\n')
    const issues = checkPrimerRoundCaptionStructure(bad)
    expect(issues.some((i) => /@handles/i.test(i.problem) || i.quote.includes('@'))).toBe(true)
    expect(issues.some((i) => /hashtag/i.test(i.problem))).toBe(true)
  })

  it('exposes the UI skeleton with hosts as names', () => {
    expect(PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON).toContain('Dennise Pérez y Rafael Lenín')
    expect(PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON).toContain(PRIMER_ROUND_HASHTAGS)
    expect(PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON).not.toContain('@denniseyperez')
  })

  it('prompt instructions lock the format', () => {
    const p = buildPrimerRoundCaptionPromptInstructions({
      title: 'Entrevista',
      hook: '¿Tema?',
      burnedOverlay: 'Exfiscal Zulma Fúster\n¿Qué impacto tendrá\nel caso?',
    })
    expect(p).toContain('FORMATO OBLIGATORIO')
    expect(p).toContain(PRIMER_ROUND_HASHTAGS)
    expect(p).toContain('Dennise Pérez y Rafael Lenín')
    expect(p).toMatch(/NUNCA pongas @denniseyperez/i)
  })
})

describe('overlay structure (lower-third)', () => {
  it('accepts 3–4 short lines with role+name then question', () => {
    const overlay = [
      'Exfiscal Zulma Fúster',
      '¿Qué impacto tendrá',
      'el caso de Elvia Cabrera',
      'en el caso de Anthonieska?',
    ].join('\n')
    expect(checkPrimerRoundOverlayStructure(overlay)).toEqual([])
  })

  it('flags too few lines, hashtags, and missing ¿', () => {
    expect(
      checkPrimerRoundOverlayStructure('Solo una linea con #magic973').some((i) =>
        /líneas/i.test(i.problem) || /hashtag/i.test(i.problem),
      ),
    ).toBe(true)
    const noOpen = [
      'Exfiscal Zulma Fúster',
      'Que impacto tendra',
      'el caso de Elvia?',
    ].join('\n')
    const issues = checkPrimerRoundOverlayStructure(noOpen)
    expect(issues.some((i) => i.problem.includes('¿'))).toBe(true)
  })
})

describe('gates merge structural template checks', () => {
  it('captionSurfaceFromText fails generic non-template captions', () => {
    const surface = captionSurfaceFromText('Escucha Primer Round en Magic 97.3')
    expect(surface.ok).toBe(false)
    expect(surface.issues.length).toBeGreaterThan(0)
  })

  it('captionSurfaceFromText accepts locked template', () => {
    const caption = buildPrimerRoundCaption({
      hook: '¿Hook?',
      guest: 'Ellyam Martínez',
    })
    expect(captionSurfaceFromText(caption).ok).toBe(true)
  })

  it('overlayFromBurnedCaptions flags short overlay', () => {
    const overlay = overlayFromBurnedCaptions({ text: 'Hoy en Primer Round', issues: [] })
    expect(overlay.ok).toBe(false)
  })
})

describe('buildIdeaCaptionPrompt primerRoundLockedTemplate', () => {
  it('uses the locked Primer Round prompt instead of the generic one', () => {
    const p = buildIdeaCaptionPrompt({
      title: 'Caso del día',
      hook: '¿Qué pasó?',
      examples: [{ text: 'estilo genérico #foo', provider: 'instagram' }],
      primerRoundLockedTemplate: true,
      videoAnalysis: {
        burnedCaptionsText: 'Exfiscal Zulma Fúster\n¿Qué impacto tendrá\nel caso?',
      },
    })
    expect(p).toContain('FORMATO OBLIGATORIO')
    expect(p).toContain(PRIMER_ROUND_HASHTAGS)
    expect(p).not.toContain('CAPTIONS DE REFERENCIA')
    expect(p).not.toContain('estilo genérico')
  })
})
