import { describe, it, expect } from 'vitest'
import {
  frameTimestamps, scaleDimensions, capFramesToBudget,
  FRAME_COUNT, FRAME_BUDGET_BYTES,
} from './video-frames'

describe('frameTimestamps', () => {
  it('devuelve N timestamps equiespaciados dentro de (0, duration)', () => {
    const ts = frameTimestamps(60, 4)
    expect(ts).toEqual([12, 24, 36, 48])
  })
  it('usa FRAME_COUNT por defecto', () => {
    expect(frameTimestamps(90)).toHaveLength(FRAME_COUNT)
  })
  it('video muy corto: al menos 1 frame en el medio, sin duplicados', () => {
    const ts = frameTimestamps(0.5, 8)
    expect(ts.length).toBeGreaterThanOrEqual(1)
    expect(new Set(ts).size).toBe(ts.length)
    for (const t of ts) { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(0.5) }
  })
  it('duración 0 o negativa: lista vacía', () => {
    expect(frameTimestamps(0)).toEqual([])
    expect(frameTimestamps(-3)).toEqual([])
  })
})

describe('scaleDimensions', () => {
  it('reescala el lado largo a maxSide manteniendo aspecto', () => {
    expect(scaleDimensions(1920, 1080, 960)).toEqual({ width: 960, height: 540 })
    expect(scaleDimensions(1080, 1920, 960)).toEqual({ width: 540, height: 960 })
  })
  it('nunca agranda un video pequeño', () => {
    expect(scaleDimensions(640, 360, 960)).toEqual({ width: 640, height: 360 })
  })
  it('redondea a enteros', () => {
    const { width, height } = scaleDimensions(1013, 771, 960)
    expect(Number.isInteger(width)).toBe(true)
    expect(Number.isInteger(height)).toBe(true)
  })
})

describe('capFramesToBudget', () => {
  const frame = (bytes: number) => 'x'.repeat(Math.ceil((bytes * 4) / 3))
  it('deja pasar frames que caben', () => {
    const frames = [frame(100_000), frame(100_000)]
    expect(capFramesToBudget(frames, 300_000)).toHaveLength(2)
  })
  it('recorta desde el final hasta caber, conservando el primero', () => {
    const frames = [frame(200_000), frame(200_000), frame(200_000)]
    const out = capFramesToBudget(frames, 450_000)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(frames[0])
  })
  it('lista vacía → vacía; usa FRAME_BUDGET_BYTES por defecto', () => {
    expect(capFramesToBudget([])).toEqual([])
    expect(FRAME_BUDGET_BYTES).toBe(3_500_000)
  })
})
