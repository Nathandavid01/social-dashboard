import { describe, it, expect } from 'vitest'
import { aspectLabel, formatFindings, formatSummaryText, isValidFormatMeta } from './video-format-rules'

describe('formatFindings — reglas de formato sin IA', () => {
  const IG = { platforms: ['instagram'] }

  it('un Reel vertical 1080×1920 de 18 s no tiene problemas', () => {
    const f = formatFindings({ width: 1080, height: 1920, durationSec: 18 }, IG)
    expect(f.aspect).toBe('9:16')
    expect(f.orientation).toBe('vertical')
    expect(f.issues).toEqual([])
    expect(formatSummaryText(f)).toBe('9:16 · 1080×1920 · 18 s')
  })

  it('horizontal para Reels/TikTok: avisa y sugiere 9:16', () => {
    const f = formatFindings({ width: 1920, height: 1080, durationSec: 20 }, { platforms: ['tiktok'] })
    expect(f.orientation).toBe('horizontal')
    expect(f.issues[0].problem).toMatch(/horizontal.*16:9.*vertical 9:16/)
  })

  it('cuadrado o 4:5 para una red sin exigencia vertical (LinkedIn) no avisa por orientación', () => {
    const f = formatFindings({ width: 1080, height: 1080, durationSec: 20 }, { platforms: ['linkedin'] })
    expect(f.issues).toEqual([])
  })

  it('resolución: <720 es grave, <1080 es aviso', () => {
    expect(formatFindings({ width: 540, height: 960, durationSec: 20 }, IG).issues[0].problem).toMatch(/Resolución baja/)
    expect(formatFindings({ width: 720, height: 1280, durationSec: 20 }, IG).issues[0].problem).toMatch(/por debajo de 1080p/)
  })

  it('duración: Reel de Instagram > 90 s avisa; TikTok hasta 10 min', () => {
    expect(formatFindings({ width: 1080, height: 1920, durationSec: 95 }, IG).issues[0].problem).toMatch(/90 s/)
    expect(formatFindings({ width: 1080, height: 1920, durationSec: 95 }, { platforms: ['tiktok'] }).issues).toEqual([])
    expect(formatFindings({ width: 1080, height: 1920, durationSec: 700 }, { platforms: ['tiktok'] }).issues[0].problem).toMatch(/10 minutos/)
  })

  it('demasiado corto (<3 s) avisa que el archivo puede estar incompleto', () => {
    expect(formatFindings({ width: 1080, height: 1920, durationSec: 1.2 }, IG).issues[0].problem).toMatch(/demasiado corto/)
  })

  it('aspectLabel tolera ±3% y cae a WxH si no es conocido', () => {
    expect(aspectLabel(1080, 1920)).toBe('9:16')
    expect(aspectLabel(1080, 1350)).toBe('4:5')
    expect(aspectLabel(1000, 1000)).toBe('1:1')
    expect(aspectLabel(1000, 1400)).toBe('1000:1400')
  })

  it('isValidFormatMeta rechaza basura del body', () => {
    expect(isValidFormatMeta({ width: 1080, height: 1920, durationSec: 18 })).toBe(true)
    expect(isValidFormatMeta({ width: '1080', height: 1920, durationSec: 18 })).toBe(false)
    expect(isValidFormatMeta({ width: 0, height: 1920, durationSec: 18 })).toBe(false)
    expect(isValidFormatMeta(null)).toBe(false)
  })
})
