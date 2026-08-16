import { describe, it, expect, vi } from 'vitest'
import { extractFramesFromVideoElement } from './video-frames-dom'

/**
 * El decode/seek real de <video> no es testeable en jsdom (mismo aviso que
 * video-scene-strip.test.tsx), pero SÍ lo son las guardas puras del motor
 * compartido: duración degenerada, readyState ya adelantado, y el timeout
 * de "se rinde" — todas manipulables sin decodificar nada real.
 */
describe('extractFramesFromVideoElement', () => {
  it('duración degenerada (Infinity) → { frames: [], timestamps: [] }, sin seeks', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
    Object.defineProperty(video, 'duration', { value: Infinity, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true })

    const timestampsFor = vi.fn(() => [1, 2, 3])
    const res = await extractFramesFromVideoElement(video, { timestampsFor })
    expect(res).toEqual({ frames: [], timestamps: [] })
    expect(timestampsFor).not.toHaveBeenCalled()
  })

  it('duración 0 → { frames: [], timestamps: [] }', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
    Object.defineProperty(video, 'duration', { value: 0, configurable: true })
    const res = await extractFramesFromVideoElement(video, { timestampsFor: () => [1] })
    expect(res).toEqual({ frames: [], timestamps: [] })
  })

  it('readyState ya en HAVE_METADATA (carrera) no cuelga esperando el evento — resuelve directo con la duración ya presente', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
    Object.defineProperty(video, 'duration', { value: 0, configurable: true }) // sin dimensiones reales en jsdom
    const res = await extractFramesFromVideoElement(video, { timestampsFor: () => [1] })
    // No lanzó ni quedó pendiente: el guard de duración cortó primero.
    expect(res).toEqual({ frames: [], timestamps: [] })
  })

  it('metadata nunca llega (readyState 0, sin evento) → se rinde a los giveUpMs con un error', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 0, configurable: true })
    await expect(
      extractFramesFromVideoElement(video, { timestampsFor: () => [1], giveUpMs: 20 }),
    ).rejects.toThrow(/tiempo de espera agotado/)
  })

  it('dimensiones nulas (videoWidth/Height en 0) → { frames: [], timestamps: [] }', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true })
    const res = await extractFramesFromVideoElement(video, { timestampsFor: () => [1, 2] })
    expect(res).toEqual({ frames: [], timestamps: [] })
  })

  it('shouldContinue() false antes del primer seek → no llama onFrame', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    Object.defineProperty(video, 'videoWidth', { value: 100, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 100, configurable: true })
    const onFrame = vi.fn()
    const res = await extractFramesFromVideoElement(video, {
      timestampsFor: () => [1, 2, 3],
      shouldContinue: () => false,
      onFrame,
    })
    expect(onFrame).not.toHaveBeenCalled()
    expect(res.frames).toEqual([])
  })
})
