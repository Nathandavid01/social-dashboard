import { describe, it, expect } from 'vitest'
import { resolveClientLogo } from './client-logo'

describe('resolveClientLogo', () => {
  it('prefers an uploaded logo_url over the Metricool picture', () => {
    expect(resolveClientLogo('https://cdn/logo.png', 'https://metricool/pic.png')).toBe('https://cdn/logo.png')
  })

  it('falls back to the Metricool picture when there is no uploaded logo', () => {
    expect(resolveClientLogo(null, 'https://metricool/pic.png')).toBe('https://metricool/pic.png')
    expect(resolveClientLogo('', 'https://metricool/pic.png')).toBe('https://metricool/pic.png')
  })

  it('returns null when neither is available (→ initials fallback in the UI)', () => {
    expect(resolveClientLogo(null, null)).toBeNull()
    expect(resolveClientLogo('', undefined)).toBeNull()
  })
})
