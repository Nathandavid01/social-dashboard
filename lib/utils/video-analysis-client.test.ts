import { describe, it, expect, vi } from 'vitest'
import { analyzeUploadedVideo } from './video-analysis-client'

const file = new File(['x'], 'v.mp4', { type: 'video/mp4' })

describe('analyzeUploadedVideo', () => {
  it('extrae frames y postea a /api/video-analysis con videoId', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true })
    const extract = vi.fn().mockResolvedValue(['data:image/jpeg;base64,AAA'])
    await analyzeUploadedVideo('vid-1', file, { extract, post })
    expect(post).toHaveBeenCalledWith('/api/video-analysis', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ videoId: 'vid-1', frames: ['data:image/jpeg;base64,AAA'] })
  })

  it('la extracción falla → no postea y NO lanza (la subida jamás se rompe)', async () => {
    const post = vi.fn()
    const extract = vi.fn().mockRejectedValue(new Error('codec'))
    await expect(analyzeUploadedVideo('vid-1', file, { extract, post })).resolves.toBeUndefined()
    expect(post).not.toHaveBeenCalled()
  })

  it('0 frames → no postea; el POST falla → no lanza', async () => {
    const post = vi.fn().mockRejectedValue(new Error('red'))
    await analyzeUploadedVideo('vid-1', file, { extract: vi.fn().mockResolvedValue([]), post })
    expect(post).not.toHaveBeenCalled()
    await expect(
      analyzeUploadedVideo('vid-1', file, { extract: vi.fn().mockResolvedValue(['data:image/jpeg;base64,A']), post }),
    ).resolves.toBeUndefined()
  })
})
