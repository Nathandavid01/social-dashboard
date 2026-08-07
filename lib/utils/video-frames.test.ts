import { describe, it, expect } from 'vitest'
import { frameTimestamps, fitFramesToBudget } from './video-frames'

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

describe('fitFramesToBudget', () => {
  const frame = (second: number, len: number) => ({ b64: 'x'.repeat(len), second })

  it('bajo el presupuesto → devuelve los frames tal cual, mismo orden', () => {
    const frames = [frame(1, 10), frame(2, 10), frame(3, 10)]
    expect(fitFramesToBudget(frames, 100)).toEqual(frames)
  })

  it('lista vacía → []', () => {
    expect(fitFramesToBudget([], 100)).toEqual([])
  })

  it('un solo frame que excede el presupuesto → []', () => {
    const frames = [frame(1, 200)]
    expect(fitFramesToBudget(frames, 100)).toEqual([])
  })

  it('sobre el presupuesto → descarta frames alternos preservando orden hasta caber', () => {
    // 10 frames de 20 chars c/u = 200 chars > 100 → debe caber en ≤100 tras descartar alternos
    const frames = Array.from({ length: 10 }, (_, i) => frame(i, 20))
    const result = fitFramesToBudget(frames, 100)
    const total = result.reduce((sum, f) => sum + f.b64.length, 0)
    expect(total).toBeLessThanOrEqual(100)
    expect(result.length).toBeGreaterThan(0)
    // orden cronológico preservado (seconds estrictamente crecientes)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].second).toBeGreaterThan(result[i - 1].second)
    }
    // son un subconjunto de los frames originales, en el mismo orden relativo
    const originalSeconds = frames.map((f) => f.second)
    const resultSeconds = result.map((f) => f.second)
    let cursor = -1
    for (const s of resultSeconds) {
      const idx = originalSeconds.indexOf(s, cursor + 1)
      expect(idx).toBeGreaterThan(cursor)
      cursor = idx
    }
  })

  it('el presupuesto exacto (suma == max) cabe sin recortar', () => {
    const frames = [frame(1, 50), frame(2, 50)]
    expect(fitFramesToBudget(frames, 100)).toEqual(frames)
  })
})
