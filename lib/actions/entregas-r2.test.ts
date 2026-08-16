import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * getEntregasUploadUrl — audit: se presignaba la subida sin validar
 * contentType, permitiendo un .html servido luego por el proxy en el
 * dominio del dashboard (XSS almacenado). Debe rechazar cualquier tipo
 * fuera de video/*.
 */

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
  currentUserHas: vi.fn(async () => true),
}))

vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: vi.fn(() => ({ send: vi.fn() })),
  entregasR2Bucket: vi.fn(() => 'nmedia-entregas'),
  isEntregasR2Configured: vi.fn(() => true),
  ENTREGAS_PROVIDER: 'entregas-r2',
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/presigned'),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: () => ({ single: async () => ({ data: { id: 'video-1' }, error: null }) }),
      })),
    })),
  })),
}))

import { getEntregasUploadUrl } from '@/lib/actions/entregas-r2'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEntregasUploadUrl — whitelist de Content-Type al subir', () => {
  it('rechaza text/html — el hueco de la auditoría', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'evil.html', contentType: 'text/html' })
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/no permitido/i)
  })

  it('rechaza image/svg+xml', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'evil.svg', contentType: 'image/svg+xml' })
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/no permitido/i)
  })

  it('rechaza contentType vacío — falla cerrado', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'sinTipo', contentType: '' })
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/no permitido/i)
  })

  it('acepta video/mp4 y sigue funcionando como hoy', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'final.mp4', contentType: 'video/mp4' })
    expect(res.error).toBeUndefined()
    expect(res.url).toBe('https://signed.example/presigned')
    expect(res.key).toMatch(/^entregas\/idea-1\/edited\//)
  })

  it('acepta video/quicktime (.mov)', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'clip.mov', contentType: 'video/quicktime' })
    expect(res.error).toBeUndefined()
    expect(res.url).toBeDefined()
  })

  it('acepta video/webm', async () => {
    const res = await getEntregasUploadUrl({ ideaId: 'idea-1', fileName: 'clip.webm', contentType: 'video/webm' })
    expect(res.error).toBeUndefined()
    expect(res.url).toBeDefined()
  })
})
