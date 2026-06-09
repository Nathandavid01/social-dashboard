import { describe, it, expect } from 'vitest'
import {
  PLATFORM_FORMATS,
  defaultFormatFor,
  defaultPlatformFormats,
  isValidFormat,
  formatLabel,
} from './platform-formats'

describe('platform-formats', () => {
  it('defines publishable formats for every social platform', () => {
    for (const p of ['instagram', 'facebook', 'tiktok', 'linkedin'] as const) {
      expect(PLATFORM_FORMATS[p].length).toBeGreaterThan(0)
    }
  })

  it('uses each platform native first format as the default', () => {
    expect(defaultFormatFor('instagram')).toBe('reel')
    expect(defaultFormatFor('tiktok')).toBe('video')
    expect(defaultFormatFor('linkedin')).toBe('post')
  })

  it('builds a default {network: format} map for the selected networks', () => {
    expect(defaultPlatformFormats(['instagram', 'tiktok'])).toEqual({
      instagram: 'reel',
      tiktok: 'video',
    })
    expect(defaultPlatformFormats([])).toEqual({})
  })

  it('validates a format against what the platform supports', () => {
    expect(isValidFormat('instagram', 'reel')).toBe(true)
    expect(isValidFormat('instagram', 'carousel')).toBe(true)
    // Instagram has no plain "video" format (it is Reel)
    expect(isValidFormat('instagram', 'video')).toBe(false)
    expect(isValidFormat('tiktok', 'video')).toBe(true)
    expect(isValidFormat('tiktok', 'reel')).toBe(false)
  })

  it('resolves a Spanish label for a platform format', () => {
    expect(formatLabel('instagram', 'reel')).toBe('Reel')
    expect(formatLabel('instagram', 'carousel')).toBe('Carrusel')
    // unknown format falls back to the raw value
    expect(formatLabel('instagram', 'mystery')).toBe('mystery')
  })
})
