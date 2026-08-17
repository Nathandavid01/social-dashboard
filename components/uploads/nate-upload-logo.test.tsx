import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { NateUploadLogo } from './nate-upload-logo'

/**
 * The N fills from the bottom up according to the real percent — asserted on
 * the clip rect's geometry (not pixels), so this stays fast and precise.
 */

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NateUploadLogo', () => {
  it('at 0% the fill rect has zero height', () => {
    mockMatchMedia(false)
    const { container } = render(<NateUploadLogo pct={0} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(Number(rect.getAttribute('height'))).toBe(0)
  })

  it('at 50% the fill rect covers half the icon height', () => {
    mockMatchMedia(false)
    const { container } = render(<NateUploadLogo pct={50} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(Number(rect.getAttribute('height'))).toBeCloseTo(256, 0)
    // Bottom-up: the rect's top (y) sits at the halfway mark, not at 0.
    expect(Number(rect.getAttribute('y'))).toBeCloseTo(256, 0)
  })

  it('at 100% the fill rect covers the whole icon', () => {
    mockMatchMedia(false)
    const { container } = render(<NateUploadLogo pct={100} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(Number(rect.getAttribute('height'))).toBe(512)
    expect(Number(rect.getAttribute('y'))).toBe(0)
  })

  it('clamps out-of-range percentages', () => {
    mockMatchMedia(false)
    const { container } = render(<NateUploadLogo pct={140} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(Number(rect.getAttribute('height'))).toBe(512)
  })

  it('transitions the fill smoothly when motion is allowed', () => {
    mockMatchMedia(false)
    const { container } = render(<NateUploadLogo pct={30} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(rect.getAttribute('style') ?? '').toMatch(/transition/i)
    expect(rect.getAttribute('style') ?? '').not.toMatch(/transition:\s*none/i)
  })

  it('disables the fill transition under prefers-reduced-motion (no decorative animation)', () => {
    mockMatchMedia(true)
    const { container } = render(<NateUploadLogo pct={30} />)
    const rect = container.querySelector('[data-testid="nate-upload-fill-rect"]')!
    expect(rect.getAttribute('style') ?? '').toMatch(/transition:\s*none/i)
    // The fill itself is still informative — height still reflects pct.
    expect(Number(rect.getAttribute('height'))).toBeGreaterThan(0)
  })
})
