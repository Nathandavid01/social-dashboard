import { describe, it, expect } from 'vitest'
import {
  frameTimestamps, scaleDimensions, capFramesToBudget, capFramesAndTimestampsToBudget, chunkFrames,
  FRAME_FPS, FRAME_MAX_COUNT, FRAME_BUDGET_BYTES, FRAME_CHUNK_SIZE, FRAME_HARD_MAX,
} from './video-frames'

describe('frameTimestamps', () => {
  it('devuelve N timestamps equiespaciados dentro de (0, duration) con count explícito', () => {
    const ts = frameTimestamps(60, 4, 4)
    expect(ts).toEqual([12, 24, 36, 48])
  })
  it('usa FRAME_FPS/FRAME_MAX_COUNT por defecto: video de 23s a 4fps → ceil(23*4)=92, tope 90', () => {
    const ts = frameTimestamps(23)
    expect(ts).toHaveLength(FRAME_MAX_COUNT)
  })
  it('video de 3s → ceil(3*4)=12 frames (no llega al tope)', () => {
    const ts = frameTimestamps(3)
    expect(ts).toHaveLength(12)
  })
  it('video largo (120s) → exactamente el tope FRAME_MAX_COUNT por defecto', () => {
    const ts = frameTimestamps(120)
    expect(ts).toHaveLength(FRAME_MAX_COUNT)
  })
  it('con maxCount=FRAME_HARD_MAX puede generar hasta 240 (video de 60s a 4fps)', () => {
    const ts = frameTimestamps(60, FRAME_FPS, FRAME_HARD_MAX)
    expect(ts).toHaveLength(FRAME_HARD_MAX)
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
  it('FRAME_FPS es 4, FRAME_MAX_COUNT es 90 (= FRAME_CHUNK_SIZE), FRAME_HARD_MAX es 240', () => {
    expect(FRAME_FPS).toBe(4)
    expect(FRAME_MAX_COUNT).toBe(90)
    expect(FRAME_CHUNK_SIZE).toBe(90)
    expect(FRAME_HARD_MAX).toBe(240)
  })
})

describe('chunkFrames', () => {
  const frames = Array.from({ length: 5 }, (_, i) => `f${i}`)
  const timestamps = [0, 1, 2, 3, 4]

  it('menos de un chunk: un solo chunk con todo', () => {
    const out = chunkFrames(frames, timestamps, 10)
    expect(out).toEqual([{ frames, timestamps }])
  })

  it('exacto: un chunk sin resto', () => {
    const out = chunkFrames(frames, timestamps, 5)
    expect(out).toEqual([{ frames, timestamps }])
  })

  it('con resto: varios chunks, el último más corto', () => {
    const out = chunkFrames(frames, timestamps, 2)
    expect(out).toEqual([
      { frames: ['f0', 'f1'], timestamps: [0, 1] },
      { frames: ['f2', 'f3'], timestamps: [2, 3] },
      { frames: ['f4'], timestamps: [4] },
    ])
  })

  it('vacío: lista de chunks vacía', () => {
    expect(chunkFrames([], [], 90)).toEqual([])
  })

  it('usa FRAME_CHUNK_SIZE por defecto', () => {
    const many = Array.from({ length: 91 }, (_, i) => `f${i}`)
    const ts = Array.from({ length: 91 }, (_, i) => i)
    const out = chunkFrames(many, ts)
    expect(out).toHaveLength(2)
    expect(out[0].frames).toHaveLength(90)
    expect(out[1].frames).toHaveLength(1)
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
