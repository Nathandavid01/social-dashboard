import { describe, it, expect, vi } from 'vitest'
import { extractFramesFromVideoElement } from './video-frames-dom'

/**
 * <video>+canvas real (decode/seek) no es simulable en jsdom, pero un
 * <video> cuyo `currentTime` dispara 'seeked' por su cuenta (con un delay
 * configurable por índice, o nunca si es `null`) SÍ deja probar el
 * comportamiento de timeout por-seek con timers reales, sin mocks del motor.
 */
function makeAutoSeekingVideo({ delays }: { delays: Array<number | null> }): HTMLVideoElement {
  const video = document.createElement('video')
  Object.defineProperty(video, 'readyState', { value: 1, configurable: true })
  Object.defineProperty(video, 'duration', { value: 10, configurable: true })
  Object.defineProperty(video, 'videoWidth', { value: 100, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: 100, configurable: true })
  let seekIndex = 0
  let currentTimeValue = 0
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTimeValue,
    set: (t: number) => {
      currentTimeValue = t
      const delay = delays[seekIndex++]
      if (delay !== null && delay !== undefined) {
        setTimeout(() => video.dispatchEvent(new Event('seeked')), delay)
      }
      // delay null/undefined → nunca dispara 'seeked' (seek "colgado").
    },
  })
  return video
}

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

  it('metadata nunca llega (readyState 0, sin evento) → se rinde a los metadataTimeoutMs con un error', async () => {
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 0, configurable: true })
    await expect(
      extractFramesFromVideoElement(video, { timestampsFor: () => [1], metadataTimeoutMs: 20 }),
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

  it('el presupuesto es POR SEEK, no acumulado: muchos frames que resuelven a tiempo (aunque el total real supere holgadamente el techo de un timeout único de 15s) terminan bien', async () => {
    // Regresión: antes había UN timeout para TODO el bucle (15s). Con
    // FRAME_HARD_MAX=240 eso da ~62ms/fotograma — aquí probamos que 20
    // fotogramas que tardan 5ms cada uno (100ms reales) no fallan aunque el
    // seekTimeoutMs configurado (50ms) sea MENOR que ese total acumulado —
    // porque el reloj se reinicia en cada seek, nunca se suma.
    const n = 20
    const video = makeAutoSeekingVideo({ delays: Array.from({ length: n }, () => 5) })
    const onFrame = vi.fn()
    const res = await extractFramesFromVideoElement(video, {
      timestampsFor: () => Array.from({ length: n }, (_, i) => i + 1),
      seekTimeoutMs: 50, // 50ms * 20 = 1000ms de techo acumulado si fuera global; cada seek individual tarda 5ms.
      onFrame,
    })
    expect(onFrame).toHaveBeenCalledTimes(n)
    expect(res.timestamps).toHaveLength(n)
    expect(res.frames).toHaveLength(0) // onFrame no devuelve nada en este test
  })

  it('un seek específico se cuelga (nunca dispara "seeked") → rechaza con el índice de ESE seek', async () => {
    const video = makeAutoSeekingVideo({ delays: [5, null, 5] })
    await expect(
      extractFramesFromVideoElement(video, {
        timestampsFor: () => [1, 2, 3],
        seekTimeoutMs: 30,
      }),
    ).rejects.toThrow(/seek #2 de 3/)
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
