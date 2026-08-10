import { describe, it, expect } from 'vitest'
import {
  coerceAgencyBranding,
  DEFAULT_AGENCY_BRANDING,
  isValidHexColor,
  normalizeBrandName,
  normalizeLogoPreset,
  normalizePrimaryColor,
  normalizeTagline,
  resolveLogoImageSrc,
  splitBrandName,
} from './agency-branding'

describe('agency branding', () => {
  it('defaults brand name when empty', () => {
    expect(normalizeBrandName('')).toBe('Nate Media')
    expect(normalizeBrandName('  ')).toBe('Nate Media')
    expect(normalizeBrandName('Mi Agencia')).toBe('Mi Agencia')
  })

  it('truncates long names and taglines', () => {
    expect(normalizeBrandName('x'.repeat(100)).length).toBe(60)
    expect(normalizeTagline('y'.repeat(100)).length).toBe(80)
  })

  it('validates and normalizes hex colors', () => {
    expect(isValidHexColor('#D4A017')).toBe(true)
    expect(isValidHexColor('#abc')).toBe(true)
    expect(isValidHexColor('red')).toBe(false)
    expect(isValidHexColor('')).toBe(false)
    expect(normalizePrimaryColor('bad')).toBe(DEFAULT_AGENCY_BRANDING.primary_color)
    expect(normalizePrimaryColor('#abc')).toBe('#AABBCC')
    expect(normalizePrimaryColor('#d4a017')).toBe('#D4A017')
  })

  it('normalizes logo presets', () => {
    expect(normalizeLogoPreset('nate_radar')).toBe('nate_radar')
    expect(normalizeLogoPreset('custom')).toBe('custom')
    expect(normalizeLogoPreset('unknown')).toBe('nate_n')
  })

  it('resolves static N logo for nate_n', () => {
    expect(resolveLogoImageSrc('nate_n', null)).toEqual({
      kind: 'image',
      src: '/icons/icon-512.svg',
    })
  })

  it('resolves radar kind for nate_radar', () => {
    expect(resolveLogoImageSrc('nate_radar', null)).toEqual({ kind: 'radar' })
  })

  it('uses custom url when present; falls back to N when custom missing', () => {
    expect(resolveLogoImageSrc('custom', 'https://cdn.example/logo.png')).toEqual({
      kind: 'image',
      src: 'https://cdn.example/logo.png',
    })
    expect(resolveLogoImageSrc('custom', null)).toEqual({
      kind: 'image',
      src: '/icons/icon-512.svg',
    })
    expect(resolveLogoImageSrc('custom', '   ')).toEqual({
      kind: 'image',
      src: '/icons/icon-512.svg',
    })
  })

  it('splits brand name so last word can take accent color', () => {
    expect(splitBrandName('Nate Media')).toEqual({ head: 'Nate', accent: 'Media' })
    expect(splitBrandName('Acme')).toEqual({ head: 'Acme', accent: '' })
    expect(splitBrandName('Mi Agencia Digital')).toEqual({
      head: 'Mi Agencia',
      accent: 'Digital',
    })
  })

  it('coerces partial/null rows to safe branding', () => {
    expect(coerceAgencyBranding(null)).toEqual(DEFAULT_AGENCY_BRANDING)
    const coerced = coerceAgencyBranding({
      brand_name: '  Studio X  ',
      logo_preset: 'custom' as const,
      logo_url: ' https://x/logo.png ',
      primary_color: 'nope',
      apply_on_login: false,
    })
    expect(coerced.brand_name).toBe('Studio X')
    expect(coerced.logo_preset).toBe('custom')
    expect(coerced.logo_url).toBe('https://x/logo.png')
    expect(coerced.primary_color).toBe(DEFAULT_AGENCY_BRANDING.primary_color)
    expect(coerced.apply_on_login).toBe(false)
    expect(coerced.tagline).toBe(DEFAULT_AGENCY_BRANDING.tagline)
  })
})
