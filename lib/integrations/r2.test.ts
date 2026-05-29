import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * r2PublicBaseUrl / r2PublicUrl build the permanent public link used by
 * consumers that need a non-expiring URL (e.g. Metricool). They are driven by
 * R2_PUBLIC_BASE_URL and must return null when public access isn't configured,
 * so the rest of the app can keep falling back to presigned (private) URLs.
 */

import { r2PublicBaseUrl, r2PublicUrl, isR2PublicConfigured } from '@/lib/integrations/r2'

const ORIGINAL = process.env.R2_PUBLIC_BASE_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.R2_PUBLIC_BASE_URL
  else process.env.R2_PUBLIC_BASE_URL = ORIGINAL
  vi.unstubAllEnvs()
})

describe('r2PublicBaseUrl', () => {
  it('returns null when unset (public access not configured)', () => {
    delete process.env.R2_PUBLIC_BASE_URL
    expect(r2PublicBaseUrl()).toBeNull()
  })

  it('returns null for an empty/whitespace value', () => {
    process.env.R2_PUBLIC_BASE_URL = '   '
    expect(r2PublicBaseUrl()).toBeNull()
  })

  it('strips trailing slashes', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://videos.natemedia.com/'
    expect(r2PublicBaseUrl()).toBe('https://videos.natemedia.com')
  })
})

describe('isR2PublicConfigured', () => {
  it('is false when no base URL is set', () => {
    delete process.env.R2_PUBLIC_BASE_URL
    expect(isR2PublicConfigured()).toBe(false)
  })

  it('is true when a base URL is set', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://videos.natemedia.com'
    expect(isR2PublicConfigured()).toBe(true)
  })
})

describe('r2PublicUrl', () => {
  it('returns null when public access is not configured', () => {
    delete process.env.R2_PUBLIC_BASE_URL
    expect(r2PublicUrl('ideas/idea-1/edited/1-final.mp4')).toBeNull()
  })

  it('joins base + key with a single slash', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://videos.natemedia.com'
    expect(r2PublicUrl('ideas/idea-1/edited/1-final.mp4')).toBe(
      'https://videos.natemedia.com/ideas/idea-1/edited/1-final.mp4',
    )
  })

  it('does not double the slash when the key has a leading slash', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://videos.natemedia.com'
    expect(r2PublicUrl('/ideas/idea-1/raw/2-clip.mp4')).toBe(
      'https://videos.natemedia.com/ideas/idea-1/raw/2-clip.mp4',
    )
  })

  it('returns null for an empty key', () => {
    process.env.R2_PUBLIC_BASE_URL = 'https://videos.natemedia.com'
    expect(r2PublicUrl('')).toBeNull()
  })
})
