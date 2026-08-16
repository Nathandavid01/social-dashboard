import { describe, it, expect } from 'vitest'
import {
  frameTimestamps, scaleDimensions, capFramesToBudget, capFramesAndTimestampsToBudget,
  FRAME_FPS, FRAME_MAX_COUNT, FRAME_BUDGET_BYTES,
} from './video-frames'

describe('frameTimestamps', () => {
  it('devuelve N timestamps equiespaciados dentro de (0, duration) con count explícito', () => {
    const ts = frameTimestamps(60, 4, 4)
    expect(ts).toEqual([12, 24, 36, 48])
  })
  it('usa FRAME_FPS/FRAME_MAX_COUNT por defecto: video de 13s a 4fps → ceil(13*4)=52, tope 48', () => {
    const ts = frameTimestamps(13)
    expect(ts).toHaveLength(FRAME_MAX_COUNT)
  })
  it('video de 3s → ceil(3*4)=12 frames (no llega al tope)', () => {
    const ts = frameTimestamps(3)
    expect(ts).toHaveLength(12)
  })
  it('video largo (120s) → exactamente el tope FRAME_MAX_COUNT', () => {
    const ts = frameTimestamps(120)
    expect(ts).toHaveLength(FRAME_MAX_COUNT)
  })
  it('video muy corto: al menos 1 frame en el medio, sin duplicados', () => {
    const ts = frameTimestamps(0.5, 8, 8)
    expect(ts.length).toBeGreaterThanOrEqual(1)
    expect(new Set(ts).size).toBe(ts.length)
    for (const t of ts) { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(0.5) }
  })
  it('duración 0 o negativa: lista vacía', () => {
    expect(frameTimestamps(0)).toEqual([])
    expect(frameTimestamps(-3)).toEqual([])
  })
  it('FRAME_FPS es 4 y FRAME_MAX_COUNT es 48', () => {
    expect(FRAME_FPS).toBe(4)
    expect(FRAME_MAX_COUNT).toBe(48)
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
  it('el default de maxSide bajó a 768', () => {
    expect(scaleDimensions(1920, 1080)).toEqual({ width: 768, height: 432 })
  })
})

describe('capFramesToBudget', () => {
  // Bytes de CABLE: el presupuesto se mide sobre la longitud de la cadena tal
  // como viaja serializada en el JSON, no sobre el tamaño decodificado.
  const frame = (wireBytes: number) => 'x'.repeat(wireBytes)
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
  it('invariante: la suma de .length de lo devuelto nunca excede el presupuesto (48 frames a 4fps)', () => {
    // Simula el caso real que disparó el bug: 48 frames de ~80KB de data-URI
    // cada uno suman ~3.84MB de cable, por encima del presupuesto — se debe
    // recortar y el total resultante debe respetar el tope.
    const frames = Array.from({ length: 48 }, () => frame(80_000))
    const out = capFramesToBudget(frames, 3_500_000)
    const totalWireBytes = out.reduce((n, f) => n + f.length, 0)
    expect(totalWireBytes).toBeLessThanOrEqual(3_500_000)
    expect(out.length).toBeLessThan(48)
  })
})

describe('capFramesAndTimestampsToBudget', () => {
  const frame = (wireBytes: number) => 'x'.repeat(wireBytes)
  it('recorta timestamps al mismo largo que los frames recortados', () => {
    const frames = [frame(200_000), frame(200_000), frame(200_000)]
    const timestamps = [1, 2, 3]
    const out = capFramesAndTimestampsToBudget(frames, timestamps, 450_000)
    expect(out.frames).toHaveLength(2)
    expect(out.timestamps).toEqual([1, 2])
  })
  it('nada que recortar: deja ambos intactos', () => {
    const frames = [frame(10_000), frame(10_000)]
    const timestamps = [0.5, 1.5]
    expect(capFramesAndTimestampsToBudget(frames, timestamps, 1_000_000)).toEqual({ frames, timestamps })
  })
})
