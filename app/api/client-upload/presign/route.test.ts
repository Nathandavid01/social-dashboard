import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/client-upload/presign — la ruta MÁS expuesta: anónima (magic link,
 * sin sesión). Antes presignaba con el contentType tal como lo mandaba el
 * cliente, sin validar nada — el hueco de XSS almacenado (audit finding).
 */

const maybeSingle = vi.fn(async () => ({ data: { id: 'client-1' } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  })),
}))

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: vi.fn() })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
}))

const getSignedUrl = vi.fn(async () => 'https://signed.example/presigned')
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...a: unknown[]) => getSignedUrl(...(a as [])) }))
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) { this.input = input }
  },
}))

import type { NextRequest } from 'next/server'
import { POST } from './route'

function req(body: unknown): NextRequest {
  return new Request('http://localhost/api/client-upload/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

beforeEach(() => {
  getSignedUrl.mockClear()
  maybeSingle.mockResolvedValue({ data: { id: 'client-1' } })
})

describe('POST /api/client-upload/presign — whitelist de Content-Type (ruta anónima)', () => {
  it('rechaza text/html — el hueco de XSS almacenado', async () => {
    const res = await POST(req({ clientId: 'client-1', fileName: 'evil.html', contentType: 'text/html' }))
    expect(res.status).toBe(400)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  it('rechaza image/svg+xml', async () => {
    const res = await POST(req({ clientId: 'client-1', fileName: 'evil.svg', contentType: 'image/svg+xml' }))
    expect(res.status).toBe(400)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  it('acepta video/mp4 y presigna como hoy', async () => {
    const res = await POST(req({ clientId: 'client-1', fileName: 'clip.mp4', contentType: 'video/mp4' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://signed.example/presigned')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('sin contentType → cae al default video/mp4 (compatibilidad), sigue funcionando', async () => {
    const res = await POST(req({ clientId: 'client-1', fileName: 'clip' }))
    expect(res.status).toBe(200)
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })
})
