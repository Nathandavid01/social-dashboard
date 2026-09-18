import { describe, expect, it } from 'vitest'
import { detectPrimerRoundPieceKind, resolvePrimerRoundPieceKind } from './piece-kind'

describe('detectPrimerRoundPieceKind', () => {
  it('GFX filename or slogan → gfx', () => {
    expect(detectPrimerRoundPieceKind({ fileName: 'PR_GFX_lunes.mov' })).toBe('gfx')
    expect(
      detectPrimerRoundPieceKind({
        burnedOverlay: 'LA NOTICIA NO ESPERA',
        transcript: '',
      }),
    ).toBe('gfx')
  })

  it('spoken clip with transcript → live', () => {
    expect(
      detectPrimerRoundPieceKind({
        fileName: 'clip-estudio.mp4',
        transcript:
          'Buenos días Puerto Rico, hoy en Primer Round hablamos del caso con Rafael y Dennise en el estudio.',
      }),
    ).toBe('live')
  })

  it('unclear material defaults to gfx', () => {
    expect(detectPrimerRoundPieceKind({})).toBe('gfx')
    expect(detectPrimerRoundPieceKind({ visualSummary: 'logo y texto' })).toBe('gfx')
  })
})

describe('resolvePrimerRoundPieceKind', () => {
  it('honors an explicit editor choice over auto-detect', () => {
    expect(
      resolvePrimerRoundPieceKind('live', { fileName: 'promo-gfx.mov' }),
    ).toBe('live')
    expect(
      resolvePrimerRoundPieceKind('gfx', {
        transcript: 'Hoy en Primer Round hablamos largo rato del tema en el estudio con los hosts.',
      }),
    ).toBe('gfx')
  })

  it('auto falls through to the detector', () => {
    expect(resolvePrimerRoundPieceKind('auto', { fileName: 'entrevista-aire.mp4' })).toBe('live')
  })
})
