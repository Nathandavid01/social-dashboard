import { describe, it, expect, vi } from 'vitest'
import { analyzeUploadedVideo } from './video-analysis-client'
import { FRAME_CHUNK_SIZE } from './video-frames'

const file = new File(['x'], 'v.mp4', { type: 'video/mp4' })

describe('analyzeUploadedVideo', () => {
  it('extrae frames y postea a /api/video-analysis con videoId, timestamps y chunk único', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true })
    const extract = vi.fn().mockResolvedValue({ frames: ['data:image/jpeg;base64,AAA'], timestamps: [0.5] })
    await analyzeUploadedVideo('vid-1', file, { extract, post })
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/video-analysis', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      videoId: 'vid-1', frames: ['data:image/jpeg;base64,AAA'], timestamps: [0.5],
      chunk: { index: 0, total: 1 },
    })
  })

  it('la extracción falla → no postea y NO lanza (la subida jamás se rompe)', async () => {
    const post = vi.fn()
    const extract = vi.fn().mockRejectedValue(new Error('codec'))
    await expect(analyzeUploadedVideo('vid-1', file, { extract, post })).resolves.toBeUndefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('0 frames → no postea; el POST falla → no lanza', async () => {
    const post = vi.fn().mockRejectedValue(new Error('red'))
    await analyzeUploadedVideo('vid-1', file, { extract: vi.fn().mockResolvedValue({ frames: [], timestamps: [] }), post })
    expect(post).not.toHaveBeenCalled()
    await expect(
      analyzeUploadedVideo('vid-1', file, {
        extract: vi.fn().mockResolvedValue({ frames: ['data:image/jpeg;base64,A'], timestamps: [0.3] }),
        post,
      }),
    ).resolves.toBeUndefined()
  })

  it('video largo: manda UN POST secuencial por chunk, en orden, con index/total', async () => {
    const n = FRAME_CHUNK_SIZE + 5
    const frames = Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,F${i}`)
    const timestamps = frames.map((_, i) => i * 0.25)
    const order: number[] = []
    const post = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      order.push(body.chunk.index)
      return { ok: true }
    })
    const extract = vi.fn().mockResolvedValue({ frames, timestamps })
    await analyzeUploadedVideo('vid-1', file, { extract, post })

    expect(post).toHaveBeenCalledTimes(2)
    expect(order).toEqual([0, 1])
    const call0 = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string)
    const call1 = JSON.parse((post.mock.calls[1][1] as RequestInit).body as string)
    expect(call0.chunk).toEqual({ index: 0, total: 2 })
    expect(call1.chunk).toEqual({ index: 1, total: 2 })
    expect(call0.frames).toHaveLength(FRAME_CHUNK_SIZE)
    expect(call1.frames).toHaveLength(5)
    expect(call0.videoId).toBe('vid-1')
    expect(call1.videoId).toBe('vid-1')
    // Alineación timestamp↔frame se conserva entre chunks.
    expect(call0.timestamps).toEqual(timestamps.slice(0, FRAME_CHUNK_SIZE))
    expect(call1.timestamps).toEqual(timestamps.slice(FRAME_CHUNK_SIZE))
  })

  it('un chunk falla → los demás igual se postean (nunca lanza)', async () => {
    const n = FRAME_CHUNK_SIZE + 5
    const frames = Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,F${i}`)
    const timestamps = frames.map((_, i) => i * 0.25)
    const post = vi.fn()
      .mockRejectedValueOnce(new Error('red caída en el chunk 0'))
      .mockResolvedValueOnce({ ok: true })
    const extract = vi.fn().mockResolvedValue({ frames, timestamps })
    await expect(analyzeUploadedVideo('vid-1', file, { extract, post })).resolves.toBeUndefined()
    expect(post).toHaveBeenCalledTimes(2)
  })
})
