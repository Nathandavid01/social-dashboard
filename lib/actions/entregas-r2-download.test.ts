import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * getEntregasDownloadUrl — el nombre del archivo tiene que llegar bien al
 * navegador. Regresión 2026-09-25: con «La Güira 48.mp4» R2 devolvía el header
 * con los bytes UTF-8 crudos y se leía «La GÃ¼ira 48.mp4».
 */

const getSignedUrl = vi.fn(async (..._args: unknown[]) => 'https://signed.example/get')
let row: Record<string, unknown> | null = null

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
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: row ? null : { message: 'no' } }) }) }),
    })),
  })),
}))

import { getEntregasDownloadUrl } from '@/lib/actions/entregas-r2'

function signedDisposition(): string {
  const command = getSignedUrl.mock.calls[0]?.[1] as { input: { ResponseContentDisposition?: string } }
  return command.input.ResponseContentDisposition ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  row = { drive_file_id: 'entregas/i1/v.mp4', storage_provider: 'entregas-r2', name: 'La Güira 48.mp4' }
})

describe('getEntregasDownloadUrl — nombre del archivo', () => {
  it('pide la descarga con un header ASCII y el nombre real en filename*', async () => {
    const res = await getEntregasDownloadUrl('v1')
    expect(res.url).toBe('https://signed.example/get')
    const header = signedDisposition()
    expect(header).toMatch(/^attachment;/)
    expect(header).toMatch(/^[\x20-\x7e]+$/)
    expect(header).toContain(`filename*=UTF-8''La%20G%C3%BCira%2048.mp4`)
  })

  it('no firma nada si el video no está en el R2 de Entregas', async () => {
    row = { drive_file_id: 'k', storage_provider: 'r2', name: 'x.mp4' }
    const res = await getEntregasDownloadUrl('v1')
    expect(res.error).toMatch(/Entregas/)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
})
