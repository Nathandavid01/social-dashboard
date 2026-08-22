import { describe, it, expect } from 'vitest'
import { clampVirality, viralityBand } from './virality'

describe('clampVirality', () => {
  it('acepta 1–10 y redondea', () => {
    expect(clampVirality(8)).toBe(8)
    expect(clampVirality(8.6)).toBe(9)
    expect(clampVirality('7')).toBe(7)
  })

  it('fuera de rango o basura es null — no inventamos un 5', () => {
    expect(clampVirality(0)).toBeNull()
    expect(clampVirality(11)).toBeNull()
    expect(clampVirality('alto')).toBeNull()
    expect(clampVirality(null)).toBeNull()
  })
})

describe('viralityBand', () => {
  it('8+ es alto, 5–7 medio, 1–4 bajo', () => {
    expect(viralityBand(9)).toBe('alto')
    expect(viralityBand(5)).toBe('medio')
    expect(viralityBand(3)).toBe('bajo')
  })
})
