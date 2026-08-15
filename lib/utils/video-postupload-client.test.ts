import { describe, it, expect, vi } from 'vitest'
import { processUploadedVideo, type ProcessUploadedVideoDeps } from './video-postupload-client'

const file = new File(['x'], 'v.mp4', { type: 'video/mp4' })
const frames8 = Array.from({ length: 8 }, (_, i) => `data:image/jpeg;base64,F${i}`)

function makeDeps(overrides: Partial<{
  extract: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  getUploadUrls: ReturnType<typeof vi.fn>
  register: ReturnType<typeof vi.fn>
  putThumb: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    extract: vi.fn().mockResolvedValue(frames8),
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
    const deps = makeDeps({ extract: vi.fn().mockResolvedValue([]) })
    await processUploadedVideo('vid-1', file, deps)
    expect(deps.post).not.toHaveBeenCalled()
    expect(deps.getUploadUrls).not.toHaveBeenCalled()
  })

  it('registerVideoThumbs falla (p.ej. columna no existe) → no lanza', async () => {
    const deps = makeDeps({ register: vi.fn().mockResolvedValue({ error: 'columna no existe' }) })
    await expect(processUploadedVideo('vid-1', file, deps)).resolves.toBeUndefined()
  })
})
