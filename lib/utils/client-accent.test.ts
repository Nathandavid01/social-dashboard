import { describe, it, expect } from 'vitest'
import { clientAccent } from './client-accent'

describe('clientAccent', () => {
  it('is stable for the same id', () => {
    expect(clientAccent('abc')).toBe(clientAccent('abc'))
  })
  it('returns a usable accent with a fallback for null', () => {
    const a = clientAccent(null)
    expect(a.dot).toMatch(/^#/)
    expect(a.text).toMatch(/^#/)
    expect(a.soft).toContain('rgba')
  })
  it('spreads different ids across the palette', () => {
    const dots = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => clientAccent(id).dot))
    expect(dots.size).toBeGreaterThan(1)
  })
})
