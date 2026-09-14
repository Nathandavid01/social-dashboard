import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (...a: unknown[]) => requirePermission(...(a as [])),
}))

const send = vi.fn(async () => ({}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: vi.fn(() => ({ send })),
  entregasR2Bucket: vi.fn(() => 'nmedia-entregas'),
  isEntregasR2Configured: vi.fn(() => true),
}))

import { PUT } from './route'

const ideaId = '7f4a8757-7811-4fb4-afc0-87dc0c50c56d'

function req(opts: {
  ideaId?: string
  fileName?: string
  contentType?: string
  body?: BodyInit
  length?: number
}) {
  const q = new URLSearchParams({
    ideaId: opts.ideaId ?? ideaId,
    fileName: opts.fileName ?? 'Primer_Round_Reel_GFX_H264.mov',
  })
  const headers = new Headers()
  if (opts.contentType) headers.set('content-type', opts.contentType)
  if (opts.length != null) headers.set('content-length', String(opts.length))
  return new Request(`http://localhost/api/entregas-upload?${q}`, {
    method: 'PUT',
    headers,
    body: opts.body ?? new Uint8Array([1, 2, 3]),
  })
}

beforeEach(() => {
  send.mockClear()
  requirePermission.mockReset().mockResolvedValue(undefined)
})

describe('PUT /api/entregas-upload', () => {
  it('sube un .mov por mismo origen y devuelve la key de Entregas', async () => {
    const res = await PUT(
      req({ contentType: 'video/quicktime', length: 3, body: new Uint8Array([1, 2, 3]) }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.key).toMatch(new RegExp(`^entregas/${ideaId}/edited/\\d+-primer-round-reel-gfx-h264\\.mov$`))
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('rechaza html y no toca R2', async () => {
    const res = await PUT(req({ fileName: 'evil.html', contentType: 'text/html', length: 3 }))
    expect(res.status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it('sin permiso no sube', async () => {
    requirePermission.mockRejectedValueOnce(new Error('Acceso denegado (falta permiso: video.upload)'))
    const res = await PUT(req({ contentType: 'video/quicktime', length: 3 }))
    expect(res.status).toBe(403)
    expect(send).not.toHaveBeenCalled()
  })
})
