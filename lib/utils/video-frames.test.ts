import { describe, it, expect } from 'vitest'
import { frameTimestamps } from './video-frames'

describe('frameTimestamps', () => {
  it('reparte count puntos equidistantes evitando el frame 0 y el último medio segundo', () => {
    const ts = frameTimestamps(60, 10)
    expect(ts).toHaveLength(10)
    expect(ts[0]).toBeGreaterThan(0)
    expect(ts[ts.length - 1]).toBeLessThanOrEqual(59.5)
    // equidistantes (paso constante)
    const step = ts[1] - ts[0]
    for (let i = 2; i < ts.length; i++) {
      expect(ts[i] - ts[i - 1]).toBeCloseTo(step, 5)
    }
  })
  it('count=1 → punto medio', () => {
    expect(frameTimestamps(30, 1)).toEqual([15])
  })
  it('video muy corto → menos frames pero al menos 1 si hay duración', () => {
    const ts = frameTimestamps(1, 10)
    expect(ts.length).toBeGreaterThanOrEqual(1)
    expect(ts.every((t) => t > 0 && t <= 1)).toBe(true)
  })
  it('duración 0, negativa o NaN → []', () => {
    expect(frameTimestamps(0, 10)).toEqual([])
    expect(frameTimestamps(-5, 10)).toEqual([])
    expect(frameTimestamps(Number.NaN, 10)).toEqual([])
  })
})
