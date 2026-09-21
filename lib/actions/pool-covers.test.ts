import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  has: true as boolean,
  rows: [] as Record<string, unknown>[],
  selectError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updates: [] as Array<{ payload: Record<string, unknown>; id: string }>,
  signed: vi.fn(async (_c: unknown, cmd: { input: { Bucket?: string; Key: string } }) =>
    `https://signed/${cmd.input.Bucket}/${cmd.input.Key}`),
}))

vi.mock('@/lib/auth/server', () => ({
  currentUserHas: vi.fn(async () => h.has),
  requirePermission: vi.fn(async () => {
    if (!h.has) throw new Error('No autorizado')
  }),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...a: unknown[]) => h.signed(...(a as [unknown, { input: { Bucket?: string; Key: string } }])),
}))
vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: vi.fn() })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: vi.fn(() => ({ send: vi.fn() })),
  entregasR2Bucket: vi.fn(() => 'nmedia-entregas'),
  isEntregasR2Configured: vi.fn(() => true),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: h.rows, error: h.selectError })),
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: h.rows[0] ?? null, error: h.selectError })),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async (_col: string, id: string) => {
          h.updates.push({ payload, id })
          return { error: h.updateError }
        }),
      })),
    })),
  })),
}))

import { getPoolCoverUrls, getPoolPosterUploadUrl, registerPoolPoster } from './pool-covers'

beforeEach(() => {
  h.has = true
  h.rows = []
  h.selectError = null
  h.updateError = null
  h.updates = []
  h.signed.mockClear()
})

describe('getPoolCoverUrls', () => {
  it('exige posting.read', async () => {
    h.has = false
    expect(await getPoolCoverUrls(['v1'])).toEqual({ error: 'No autorizado' })
  })

  it('firma el primer thumb_key en el bucket del video (entregas vs pipeline)', async () => {
    h.rows = [
      {
        id: 'ed',
        thumb_keys: ['ideas/i1/edited/thumbs/0.jpg'],
        storage_provider: 'entregas-r2',
        status: 'uploaded',
      },
      {
        id: 'raw',
        thumb_keys: ['ideas/i1/raw/thumbs/0.jpg'],
        storage_provider: 'r2',
        status: 'uploaded',
      },
    ]
    const res = await getPoolCoverUrls(['ed', 'raw'])
    expect(res.error).toBeUndefined()
    expect(res.urls).toEqual({
      ed: 'https://signed/nmedia-entregas/ideas/i1/edited/thumbs/0.jpg',
      raw: 'https://signed/nmedia-videos/ideas/i1/raw/thumbs/0.jpg',
    })
  })

  it('sin thumb_keys o archivado no inventa URL', async () => {
    h.rows = [
      { id: 'empty', thumb_keys: [], storage_provider: 'entregas-r2', status: 'uploaded' },
      { id: 'dead', thumb_keys: ['k.jpg'], storage_provider: 'r2', status: 'archived' },
    ]
    expect(await getPoolCoverUrls(['empty', 'dead'])).toEqual({ urls: {} })
  })
})

describe('registerPoolPoster / getPoolPosterUploadUrl', () => {
  it('exige video.upload para generar o guardar el poster', async () => {
    h.has = false
    expect(await getPoolPosterUploadUrl('ed')).toEqual({ error: 'No autorizado' })
    expect(await registerPoolPoster('ed', 'ideas/i1/edited/thumbs/poster.jpg')).toEqual({
      error: 'No autorizado',
    })
    expect(h.updates).toEqual([])
  })

  it('presigna el poster en el mismo bucket del mp4', async () => {
    h.rows = [{
      id: 'ed',
      drive_file_id: 'ideas/i1/edited/cut.mp4',
      storage_provider: 'entregas-r2',
      thumb_keys: null,
    }]
    const res = await getPoolPosterUploadUrl('ed')
    expect(res.error).toBeUndefined()
    expect(res.key).toBe('ideas/i1/edited/thumbs/poster.jpg')
    expect(res.url).toBe('https://signed/nmedia-entregas/ideas/i1/edited/thumbs/poster.jpg')
  })

  it('no registra una key de otro video (sin FK Dual-R2)', async () => {
    h.rows = [{
      id: 'ed',
      drive_file_id: 'ideas/i1/edited/cut.mp4',
      storage_provider: 'entregas-r2',
      thumb_keys: null,
    }]
    const res = await registerPoolPoster('ed', 'ideas/OTHER/edited/thumbs/poster.jpg')
    expect(res.error).toMatch(/inválid/i)
    expect(h.updates).toEqual([])
  })

  it('guarda el poster en thumb_keys del mismo video si aún no hay tira', async () => {
    h.rows = [{
      id: 'ed',
      drive_file_id: 'ideas/i1/edited/cut.mp4',
      storage_provider: 'entregas-r2',
      thumb_keys: null,
    }]
    const res = await registerPoolPoster('ed', 'ideas/i1/edited/thumbs/poster.jpg')
    expect(res).toEqual({ ok: true })
    expect(h.updates).toEqual([{
      id: 'ed',
      payload: { thumb_keys: ['ideas/i1/edited/thumbs/poster.jpg'] },
    }])
  })

  it('no pisa thumb_keys que ya existen', async () => {
    h.rows = [{
      id: 'ed',
      drive_file_id: 'ideas/i1/edited/cut.mp4',
      storage_provider: 'entregas-r2',
      thumb_keys: ['ideas/i1/edited/thumbs/0.jpg'],
    }]
    expect(await registerPoolPoster('ed', 'ideas/i1/edited/thumbs/poster.jpg')).toEqual({ ok: true })
    expect(h.updates).toEqual([])
  })
})
