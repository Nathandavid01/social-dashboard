import { describe, it, expect } from 'vitest'
import {
  buildPrimerRoundCaption,
  buildPrimerRoundCaptionPromptInstructions,
  checkPrimerRoundCaptionStructure,
  checkPrimerRoundOverlayStructure,
  normalizePrimerRoundCaption,
  PRIMER_ROUND_HASHTAGS,
  PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON,
} from './caption-template'
import { captionSurfaceFromText, overlayFromBurnedCaptions } from './orthography'
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'

describe('Primer Round locked caption template', () => {
  it('builds the Exact IG skeleton Eric locked', () => {
    const caption = buildPrimerRoundCaption({
      hook: '¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?',
      guest: 'Exfiscal Zulma Fúster',
      airCopy: { when: 'hoy', phrase: 'hoy desde las 5:43 AM' },
    })
    expect(caption).toBe(
      [
        '¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?',
        '',
        'Exfiscal Zulma Fúster hoy desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.',
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
    expect(PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON).toContain('Rafael Lenín López y Dennise Pérez')
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
    expect(p).toContain('Rafael Lenín López y Dennise Pérez')
    expect(p).toMatch(/NUNCA pongas @denniseyperez/i)
  })

  it('Sunday uses the Facebook air line on GFX Reels', () => {
    const p = buildPrimerRoundCaptionPromptInstructions({
      title: 'GFX',
      airNowMs: Date.parse('2026-09-14T01:40:00Z'),
    })
    expect(p).toContain('Mañana desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.')
    expect(p).toContain('LA NOTICIA NO ESPERA')
    expect(p).toContain('GFX/promo')
    const caption = buildPrimerRoundCaption({
      hook: 'LA NOTICIA NO ESPERA',
      guest: 'LA NOTICIA NO ESPERA',
      airCopy: { when: 'mañana', phrase: 'mañana desde las 5:43 AM' },
    })
    expect(caption).toBe(
      [
        'LA NOTICIA NO ESPERA',
        '',
        'Mañana desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.',
        '',
        PRIMER_ROUND_HASHTAGS,
      ].join('\n'),
    )
    expect(caption).not.toMatch(/LA NOTICIA NO ESPERA [Mm]añana/)
    expect(checkPrimerRoundCaptionStructure(caption)).toEqual([])
    expect(p).toMatch(/NO empieces la línea 3 con la misma frase/i)
    expect(p).not.toMatch(/LA NOTICIA NO ESPERA Mañana desde las 5:43 AM/)
  })
})

describe('normalizePrimerRoundCaption', () => {
  it('strips a repeated LA NOTICIA NO ESPERA before the air line', () => {
    const stale = [
      'LA NOTICIA NO ESPERA',
      '',
      'LA NOTICIA NO ESPERA hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.',
      '',
      PRIMER_ROUND_HASHTAGS,
    ].join('\n')
    const next = normalizePrimerRoundCaption(stale, {
      when: 'mañana',
      phrase: 'mañana desde las 5:43 AM',
    })
    expect(next).toBe(
      [
        'LA NOTICIA NO ESPERA',
        '',
        'Mañana desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.',
        '',
        PRIMER_ROUND_HASHTAGS,
      ].join('\n'),
    )
    expect(checkPrimerRoundCaptionStructure(stale).some((i) => /horario de aire|no repitas el gancho/i.test(i.problem))).toBe(
      true,
    )
    expect(
      normalizePrimerRoundCaption(
        [
          '¿Quién responde?',
          '',
          'LA NOTICIA NO ESPERA hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.',
          '',
          PRIMER_ROUND_HASHTAGS,
        ].join('\n'),
        { when: 'mañana', phrase: 'mañana desde las 5:43 AM' },
      ),
    ).toBe(
      [
        '¿Quién responde?',
        '',
        'Mañana desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.',
        '',
        PRIMER_ROUND_HASHTAGS,
      ].join('\n'),
    )
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
        visualSummary: 'Estudio de radio, invitados frente a micrófonos Magic 97.3',
      },
    })
    expect(p).toContain('FORMATO OBLIGATORIO')
    expect(p).toContain(PRIMER_ROUND_HASHTAGS)
    expect(p).toContain('Estudio de radio, invitados frente a micrófonos Magic 97.3')
    expect(p).not.toContain('CAPTIONS DE REFERENCIA')
    expect(p).not.toContain('estilo genérico')
  })

  it('passes Eric feedback into the locked Primer Round prompt', () => {
    const p = buildIdeaCaptionPrompt({
      title: 'Caso del día',
      examples: [],
      primerRoundLockedTemplate: true,
      previousCaption: '¿Quién responde?\n\nLA NOTICIA NO ESPERA hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.\n\n#magic973 #puertorico #primerround',
      feedback: 'El gancho debe ser LA NOTICIA NO ESPERA, no las tres preguntas',
      styleRules: ['El gancho sale del overlay, no de las tres preguntas'],
    })
    expect(p).toContain('FEEDBACK DE ERIC')
    expect(p).toContain('El gancho debe ser LA NOTICIA NO ESPERA')
    expect(p).toContain('CAPTION ANTERIOR')
    expect(p).toContain('¿Quién responde?')
    expect(p).toContain('ESTILO DE LOS REELS DE PRIMER ROUND')
    expect(p).toContain('El gancho sale del overlay, no de las tres preguntas')
  })
})
