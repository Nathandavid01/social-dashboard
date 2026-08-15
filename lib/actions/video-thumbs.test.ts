import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Server actions for the "tira de 5 escenas" thumbnails: presign PUTs on the
 * SAME bucket the video lives in (r2 vs entregas-r2), register the keys, and
 * presign GETs to view them. Everything here must degrade safely — a missing
 * `thumb_keys` column or a failed presign never throws past these actions.
 */

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: unknown, cmd: { input: { Key: string } }) =>
    `https://signed/${cmd.input.Key}`),
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
  ENTREGAS_PROVIDER: 'entregas-r2',
}))

// Mutable per-test fixture the mocked Supabase client reads from.
let videoRow: Record<string, unknown> | null = null
let selectError: { message: string } | null = null
let updateError: { message: string } | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: videoRow, error: selectError })),
          maybeSingle: vi.fn(async () => ({ data: videoRow, error: selectError })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: updateError })),
      })),
    })),
  })),
}))

import { getThumbUploadUrls, registerVideoThumbs, getVideoThumbViewUrls } from './video-thumbs'

beforeEach(() => {
  vi.clearAllMocks()
  videoRow = null
  selectError = null
  updateError = null
})

describe('getThumbUploadUrls', () => {
  it('presigna N PUTs en el bucket r2 bajo <carpeta-del-video>/thumbs/', async () => {
    videoRow = { drive_file_id: 'ideas/idea-1/edited/123-final.mp4', storage_provider: 'r2' }
    const res = await getThumbUploadUrls('vid-1', 5)
    expect(res.error).toBeUndefined()
    expect(res.urls).toHaveLength(5)
    expect(res.keys).toHaveLength(5)
    res.keys!.forEach((k) => expect(k).toMatch(/^ideas\/idea-1\/edited\/thumbs\/\d+-\d\.jpg$/))
  })

  it('presigna en el bucket de entregas-r2 cuando el video vive ahí', async () => {
    videoRow = { drive_file_id: 'entregas/idea-2/edited/9-x.mp4', storage_provider: 'entregas-r2' }
    const res = await getThumbUploadUrls('vid-2', 3)
    expect(res.keys).toHaveLength(3)
    res.keys!.forEach((k) => expect(k).toMatch(/^entregas\/idea-2\/edited\/thumbs\//))
  })

  it('video no encontrado → error, no lanza', async () => {
    videoRow = null
    selectError = { message: 'no rows' }
    await expect(getThumbUploadUrls('missing', 5)).resolves.toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    )
  })

  it('proveedor no soportado (drive) → error', async () => {
    videoRow = { drive_file_id: null, storage_provider: 'drive' }
    const res = await getThumbUploadUrls('vid-3', 5)
    expect(res.error).toBeDefined()
  })
})

describe('registerVideoThumbs', () => {
  it('actualiza thumb_keys en la fila', async () => {
    const res = await registerVideoThumbs('vid-1', ['a.jpg', 'b.jpg'])
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
  })

  it('columna inexistente → {error}, no lanza', async () => {
    updateError = { message: 'column "thumb_keys" does not exist' }
    await expect(registerVideoThumbs('vid-1', ['a.jpg'])).resolves.toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    )
  })
})

describe('getVideoThumbViewUrls', () => {
  it('thumb_keys vacío/null → { urls: [] }', async () => {
    videoRow = { thumb_keys: null, storage_provider: 'r2' }
    const res = await getVideoThumbViewUrls('vid-1')
    expect(res.urls).toEqual([])
  })

  it('con thumb_keys → presigna GETs en el bucket correcto', async () => {
    videoRow = { thumb_keys: ['ideas/i1/edited/thumbs/1-0.jpg', 'ideas/i1/edited/thumbs/1-1.jpg'], storage_provider: 'r2' }
    const res = await getVideoThumbViewUrls('vid-1')
    expect(res.urls).toHaveLength(2)
    expect(res.urls![0]).toContain('signed')
  })

  it('columna no existe (error de select) → { urls: [] }, no lanza', async () => {
    videoRow = null
    selectError = { message: 'column "thumb_keys" does not exist' }
    await expect(getVideoThumbViewUrls('vid-1')).resolves.toEqual({ urls: [] })
  })

  it('video no encontrado → { urls: [] }', async () => {
    videoRow = null
    const res = await getVideoThumbViewUrls('missing')
    expect(res.urls).toEqual([])
  })
})
