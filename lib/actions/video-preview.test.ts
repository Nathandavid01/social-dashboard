import { beforeEach, describe, expect, it, vi } from 'vitest'

const getR2PreviewUrl = vi.fn()
const getEntregasPreviewUrl = vi.fn()
const maybeSingle = vi.fn()

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2PreviewUrl: (...a: unknown[]) => getR2PreviewUrl(...a),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregasPreviewUrl: (...a: unknown[]) => getEntregasPreviewUrl(...a),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingle(),
        }),
      }),
    }),
  }),
}))

import { getVideoPreviewUrl } from './video-preview'

describe('getVideoPreviewUrl (dual-R2 viewing)', () => {
  beforeEach(() => {
    getR2PreviewUrl.mockReset()
    getEntregasPreviewUrl.mockReset()
    maybeSingle.mockReset()
  })

  it('routes pipeline r2 videos to getR2PreviewUrl so old-bucket files stay viewable', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'v1', storage_provider: 'r2', status: 'uploaded' },
      error: null,
    })
    getR2PreviewUrl.mockResolvedValue({ url: 'https://signed.example/r2.mp4' })

    const res = await getVideoPreviewUrl('v1')
    expect(getR2PreviewUrl).toHaveBeenCalledWith('v1')
    expect(getEntregasPreviewUrl).not.toHaveBeenCalled()
    expect(res).toEqual({ url: 'https://signed.example/r2.mp4', provider: 'r2' })
  })

  it('routes entregas-r2 videos to getEntregasPreviewUrl', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'v2', storage_provider: 'entregas-r2', status: 'uploaded' },
      error: null,
    })
    getEntregasPreviewUrl.mockResolvedValue({ url: 'https://signed.example/ent.mp4' })

    const res = await getVideoPreviewUrl('v2')
    expect(getEntregasPreviewUrl).toHaveBeenCalledWith('v2')
    expect(getR2PreviewUrl).not.toHaveBeenCalled()
    expect(res.url).toBe('https://signed.example/ent.mp4')
  })

  it('does not call R2-only preview for entregas rows (the old bug)', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'v3', storage_provider: 'entregas-r2', status: 'uploaded' },
      error: null,
    })
    getEntregasPreviewUrl.mockResolvedValue({ url: 'https://ok' })
    await getVideoPreviewUrl('v3')
    expect(getR2PreviewUrl).not.toHaveBeenCalled()
  })
})
