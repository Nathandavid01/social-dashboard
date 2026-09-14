import { describe, it, expect } from 'vitest'
import { collectPrimerRoundStyleRules, formatPrimerRoundStyleRulesBlock, PRIMER_ROUND_GFX_STYLE_RULES } from './style-rules'

describe('collectPrimerRoundStyleRules', () => {
  it('keeps newest unique notes and splits caption_notes bullets', () => {
    expect(
      collectPrimerRoundStyleRules([
        'El gancho es LA NOTICIA NO ESPERA, no las tres preguntas',
        '- El gancho es LA NOTICIA NO ESPERA, no las tres preguntas\n- Hosts siempre como nombres',
        'ok',
      ]),
    ).toEqual([
      'El gancho es LA NOTICIA NO ESPERA, no las tres preguntas',
      'Hosts siempre como nombres',
    ])
  })

  it('returns empty when there is no real style yet', () => {
    expect(collectPrimerRoundStyleRules(['', '  ', 'ab'])).toEqual([])
  })

  it('locks GFX promo rules (not show clips) including Sunday air time', () => {
    expect(PRIMER_ROUND_GFX_STYLE_RULES.some((r) => /GFX/i.test(r))).toBe(true)
    expect(PRIMER_ROUND_GFX_STYLE_RULES.some((r) => /5:43am/i.test(r))).toBe(true)
    expect(PRIMER_ROUND_GFX_STYLE_RULES.some((r) => /clip/i.test(r))).toBe(true)
    expect(PRIMER_ROUND_GFX_STYLE_RULES.some((r) => /no repitas el gancho/i.test(r))).toBe(true)
  })
})

describe('formatPrimerRoundStyleRulesBlock', () => {
  it('labels the rules as standing Primer Round Reel style', () => {
    const block = formatPrimerRoundStyleRulesBlock(['El gancho sale del overlay, no de las preguntas'])
    expect(block).toContain('ESTILO DE LOS REELS DE PRIMER ROUND')
    expect(block).toContain('este cliente y este tipo de video')
    expect(block).toContain('El gancho sale del overlay, no de las preguntas')
  })
})
