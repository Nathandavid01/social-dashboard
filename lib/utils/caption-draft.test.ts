import { describe, expect, it } from 'vitest'
import {
  displayCaptionDraft,
  packCaptionDrafts,
  parseCaptionDrafts,
} from './caption-draft'

describe('packCaptionDrafts / parseCaptionDrafts', () => {
  it('round-trips one draft per network', () => {
    const packed = packCaptionDrafts([
      { platform: 'instagram', text: 'hook IG' },
      { platform: 'tiktok', text: 'oral TT' },
    ])
    expect(JSON.parse(packed).by).toEqual({ instagram: 'hook IG', tiktok: 'oral TT' })
    expect(parseCaptionDrafts(packed)).toEqual([
      { platform: 'instagram', text: 'hook IG' },
      { platform: 'tiktok', text: 'oral TT' },
    ])
  })

  it('treats a plain-text draft as a single all-networks caption', () => {
    expect(parseCaptionDrafts('borrador de ayer')).toEqual([
      { platform: 'all', text: 'borrador de ayer' },
    ])
  })

  it('drops empty texts', () => {
    expect(packCaptionDrafts([
      { platform: 'instagram', text: '  ' },
      { platform: 'tiktok', text: 'sí' },
    ])).toBe(packCaptionDrafts([{ platform: 'tiktok', text: 'sí' }]))
  })
})

describe('displayCaptionDraft', () => {
  it('shows a single draft as the text, without JSON', () => {
    expect(displayCaptionDraft(packCaptionDrafts([
      { platform: 'instagram', text: 'solo IG' },
    ]))).toBe('solo IG')
    expect(displayCaptionDraft('texto plano')).toBe('texto plano')
  })

  it('stacks one labeled block per network so the caja can show both', () => {
    const shown = displayCaptionDraft(packCaptionDrafts([
      { platform: 'instagram', text: 'hook IG' },
      { platform: 'tiktok', text: 'oral TT' },
    ]))
    expect(shown).toContain('[Instagram]')
    expect(shown).toContain('hook IG')
    expect(shown).toContain('[TikTok]')
    expect(shown).toContain('oral TT')
    expect(shown).not.toContain('{')
  })

  it('is empty when there is nothing', () => {
    expect(displayCaptionDraft(null)).toBe('')
    expect(displayCaptionDraft('  ')).toBe('')
  })
})
