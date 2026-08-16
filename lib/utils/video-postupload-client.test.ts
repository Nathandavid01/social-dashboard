import { describe, it, expect, vi } from 'vitest'
import { processUploadedVideo, type ProcessUploadedVideoDeps } from './video-postupload-client'
import { FRAME_CHUNK_SIZE } from './video-frames'

const file = new File(['x'], 'v.mp4', { type: 'video/mp4' })
const frames8 = Array.from({ length: 8 }, (_, i) => `data:image/jpeg;base64,F${i}`)
// Coherentes con frames8: un timestamp (en segundos) por frame, en el mismo orden.
const timestamps8 = frames8.map((_, i) => i * 0.5)

function makeDeps(overrides: Partial<{
  extract: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  getUploadUrls: ReturnType<typeof vi.fn>
  register: ReturnType<typeof vi.fn>
  putThumb: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    extract: vi.fn().mockResolvedValue({ frames: frames8, timestamps: timestamps8 }),
    post: vi.fn().mockResolvedValue({ ok: true }),
    getUploadUrls: vi.fn().mockResolvedValue({
      urls: ['https://put/0', 'https://put/1', 'https://put/2', 'https://put/3', 'https://put/4'],
      keys: ['k0', 'k1', 'k2', 'k3', 'k4'],
    }),
    register: vi.fn().mockResolvedValue({ ok: true }),
    putThumb: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Required<ProcessUploadedVideoDeps>
}

describe('processUploadedVideo', () => {
  it('extrae UNA vez y hace ambos: postea análisis y sube+registra 5 thumbnails', async () => {
    const deps = makeDeps()
    await processUploadedVideo('vid-1', file, deps)

    expect(deps.extract).toHaveBeenCalledTimes(1)
    expect(deps.extract).toHaveBeenCalledWith(file)

    expect(deps.post).toHaveBeenCalledWith('/api/video-analysis', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((vi.mocked(deps.post).mock.calls[0][1] as RequestInit).body as string)
    expect(body.videoId).toBe('vid-1')
    expect(body.frames).toEqual(frames8)
    expect(body.timestamps).toEqual(timestamps8)
    // Alineación: el timestamp[i] describe al frame[i], no un array cualquiera del mismo tamaño.
    expect(body.timestamps).toHaveLength(body.frames.length)
    body.frames.forEach((frameUri: string, i: number) => {
      const frameIndex = Number(frameUri.match(/F(\d+)$/)?.[1])
      expect(body.timestamps[i]).toBe(frameIndex * 0.5)
    })

    expect(deps.getUploadUrls).toHaveBeenCalledWith('vid-1', 5)
    expect(deps.putThumb).toHaveBeenCalledTimes(5)
    expect(deps.register).toHaveBeenCalledWith('vid-1', ['k0', 'k1', 'k2', 'k3', 'k4'])
  })

  it('la extracción falla → no postea, no sube thumbnails, y NO lanza', async () => {
    const deps = makeDeps({ extract: vi.fn().mockRejectedValue(new Error('codec')) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
    expect(deps.post).not.toHaveBeenCalled()
    expect(deps.getUploadUrls).not.toHaveBeenCalled()
  })

  it('el análisis falla pero los thumbnails siguen subiéndose', async () => {
    const deps = makeDeps({ post: vi.fn().mockRejectedValue(new Error('red')) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
    expect(deps.register).toHaveBeenCalledWith('vid-1', ['k0', 'k1', 'k2', 'k3', 'k4'])
  })

  it('los thumbnails fallan pero el análisis sigue posteándose', async () => {
    const deps = makeDeps({ getUploadUrls: vi.fn().mockRejectedValue(new Error('r2 caído')) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
    expect(deps.post).toHaveBeenCalled()
    expect(deps.register).not.toHaveBeenCalled()
  })

  it('getUploadUrls devuelve {error} → no registra, no lanza', async () => {
    const deps = makeDeps({ getUploadUrls: vi.fn().mockResolvedValue({ error: 'sin config' }) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
    expect(deps.register).not.toHaveBeenCalled()
    expect(deps.post).toHaveBeenCalled()
  })

  it('0 frames extraídos → no postea ni sube nada', async () => {
    const deps = makeDeps({ extract: vi.fn().mockResolvedValue({ frames: [], timestamps: [] }) })
    await processUploadedVideo('vid-1', file, deps)
    expect(deps.post).not.toHaveBeenCalled()
    expect(deps.getUploadUrls).not.toHaveBeenCalled()
  })

  it('video largo: el análisis se postea en varios chunks secuenciales; los thumbnails no se ven afectados', async () => {
    const n = FRAME_CHUNK_SIZE + 3
    const frames = Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,F${i}`)
    const timestamps = frames.map((_, i) => i * 0.25)
    const posted: number[] = []
    const post = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      posted.push(JSON.parse(init.body as string).chunk.index)
      return { ok: true }
    })
    const deps = makeDeps({ extract: vi.fn().mockResolvedValue({ frames, timestamps }), post })
    await processUploadedVideo('vid-1', file, deps)
    expect(posted).toEqual([0, 1])
    expect(deps.register).toHaveBeenCalledWith('vid-1', ['k0', 'k1', 'k2', 'k3', 'k4'])
  })

  it('registerVideoThumbs falla (p.ej. columna no existe) → no lanza', async () => {
    const deps = makeDeps({ register: vi.fn().mockResolvedValue({ error: 'columna no existe' }) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
  })

  it('el PUT por defecto verifica res.ok — si R2 rechaza (403/5xx) sin lanzar, NO registra las keys', async () => {
    const register = vi.fn().mockResolvedValue({ ok: true })
    const getUploadUrls = vi.fn().mockResolvedValue({ urls: ['https://put/0'], keys: ['k0'] })
    const extract = vi.fn().mockResolvedValue({ frames: ['data:image/jpeg;base64,AAA'], timestamps: [1.5] })
    const post = vi.fn().mockResolvedValue({ ok: true })

    const originalFetch = global.fetch
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.startsWith('data:')) {
        // dataUriToBlob(dataUri) — convierte el frame a Blob antes del PUT.
        return new Response(new Blob(['x'], { type: 'image/jpeg' }))
      }
      // El PUT a la URL firmada "resuelve" pero con un status de error —
      // exactamente el caso que un simple `await fetch(...)` sin chequear
      // .ok se traga en silencio.
      return new Response(null, { status: 403 })
    }) as unknown as typeof fetch

    try {
      await expect(
        processUploadedVideo('vid-1', file, { extract, getUploadUrls, register, post }),
      ).resolves.toBeUndefined()
      expect(register).not.toHaveBeenCalled()
    } finally {
      global.fetch = originalFetch
    }
  })
})
