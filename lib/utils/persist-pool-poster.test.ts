import { describe, expect, it, vi } from 'vitest'
import { persistPoolPosterFromCanvas } from './persist-pool-poster'

const canvas = {} as HTMLCanvasElement

describe('persistPoolPosterFromCanvas', () => {
  it('sube el JPEG y registra la key del mismo video', async () => {
    const getUploadUrl = vi.fn(async () => ({ url: 'https://put.example/p', key: 'ideas/i1/edited/thumbs/poster.jpg' }))
    const register = vi.fn(async () => ({ ok: true as const }))
    const put = vi.fn(async () => ({ ok: true }))
    const toBlob = vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' }))

    await expect(persistPoolPosterFromCanvas(canvas, 'ed', {
      toBlob, getUploadUrl, register, put,
    })).resolves.toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith('https://put.example/p', expect.any(Blob))
    expect(register).toHaveBeenCalledWith('ed', 'ideas/i1/edited/thumbs/poster.jpg')
  })

  it('si el PUT falla no registra thumb_keys', async () => {
    const register = vi.fn(async () => ({ ok: true as const }))
    const res = await persistPoolPosterFromCanvas(canvas, 'ed', {
      toBlob: async () => new Blob(['jpg']),
      getUploadUrl: async () => ({ url: 'https://put.example/p', key: 'k.jpg' }),
      register,
      put: async () => ({ ok: false }),
    })
    expect(res).toEqual({ ok: false })
    expect(register).not.toHaveBeenCalled()
  })

  it('sin canvas o sin blob no llama a R2', async () => {
    const getUploadUrl = vi.fn()
    expect(await persistPoolPosterFromCanvas(null, 'ed', { getUploadUrl })).toEqual({ ok: false })
    expect(await persistPoolPosterFromCanvas(canvas, 'ed', {
      toBlob: async () => null,
      getUploadUrl,
    })).toEqual({ ok: false })
    expect(getUploadUrl).not.toHaveBeenCalled()
  })
})
