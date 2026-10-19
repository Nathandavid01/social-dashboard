import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSignedUrl = vi.fn<(client: unknown, command: { input: { Bucket?: string; Key?: string; ResponseContentDisposition?: string } }) => Promise<string>>(
  async () => 'https://signed.example/download.mp4',
)
const pipelineClient = { name: 'pipeline-r2' }
const entregasClient = { name: 'entregas-r2' }
const maybeSingle = vi.fn()
const getUser = vi.fn(async () => ({ data: { user: { id: 'copy-1' } } }))
const currentUserHas = vi.fn<(perm: string) => Promise<boolean>>(async () => false)
const getEffectiveRole = vi.fn(async () => 'copy')
const getEffectiveUserId = vi.fn(async () => 'copy-1')

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (client: unknown, command: unknown) => getSignedUrl(client, command as { input: { Bucket?: string; Key?: string; ResponseContentDisposition?: string } }),
}))
vi.mock('@/lib/integrations/r2', () => ({
  r2Client: () => pipelineClient,
  r2Bucket: () => 'nmedia-videos',
  isR2Configured: () => true,
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: () => entregasClient,
  entregasR2Bucket: () => 'nmedia-entregas',
  isEntregasR2Configured: () => true,
}))
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
  getEffectiveRole: () => getEffectiveRole(),
  getEffectiveUserId: () => getEffectiveUserId(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}))

import { getVideoDownloadUrl } from './video-download'

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    kind: 'edited',
    status: 'uploaded',
    drive_file_id: 'ideas/idea-1/edited/yabushi.mp4',
    storage_provider: 'r2',
    name: 'Yabushi reel.mp4',
    uploaded_by: 'eric',
    idea: { production_task: null, client: { assigned_to: null } },
    ...over,
  }
}

beforeEach(() => {
  getSignedUrl.mockClear()
  maybeSingle.mockReset()
  currentUserHas.mockReset()
  currentUserHas.mockResolvedValue(false)
  getEffectiveRole.mockResolvedValue('copy')
  getEffectiveUserId.mockResolvedValue('copy-1')
  getUser.mockResolvedValue({ data: { user: { id: 'copy-1' } } })
})

describe('getVideoDownloadUrl — Denisha / Recibo dual-R2 (v5.149)', () => {
  it('lets copy with entregas.read download an edited pipeline-r2 cut without being assigned', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm === 'entregas.read')
    maybeSingle.mockResolvedValue({ data: row(), error: null })

    const res = await getVideoDownloadUrl('v1')

    expect(res.url).toBe('https://signed.example/download.mp4')
    expect(res.provider).toBe('r2')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
    expect(getSignedUrl.mock.calls[0]?.[0]).toBe(pipelineClient)
    const command = getSignedUrl.mock.calls[0]?.[1]
    expect(command?.input.Bucket).toBe('nmedia-videos')
    expect(command?.input.Key).toBe('ideas/idea-1/edited/yabushi.mp4')
    expect(command?.input.ResponseContentDisposition).toMatch(/^attachment;/)
    expect(command?.input.ResponseContentDisposition).toContain(`filename*=UTF-8''Yabushi%20reel.mp4`)
  })

  it('lets copy with entregas.read download an edited entregas-r2 cut from the Entregas bucket', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm === 'entregas.read')
    maybeSingle.mockResolvedValue({
      data: row({
        storage_provider: 'entregas-r2',
        drive_file_id: 'entregas/idea-1/edited/yabushi.mp4',
      }),
      error: null,
    })

    const res = await getVideoDownloadUrl('v1')

    expect(res.url).toBe('https://signed.example/download.mp4')
    expect(res.provider).toBe('entregas-r2')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
    expect(getSignedUrl.mock.calls[0]?.[0]).toBe(entregasClient)
    const command = getSignedUrl.mock.calls[0]?.[1]
    expect(command?.input.Bucket).toBe('nmedia-entregas')
    expect(command?.input.Key).toBe('entregas/idea-1/edited/yabushi.mp4')
  })

  it('does not let copy with entregas.read download raw pipeline footage they were not assigned', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm === 'entregas.read')
    maybeSingle.mockResolvedValue({
      data: row({
        kind: 'raw',
        drive_file_id: 'ideas/idea-1/raw/crudo.mp4',
        name: 'crudo.mp4',
      }),
      error: null,
    })

    const res = await getVideoDownloadUrl('v1')

    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/no autorizado/i)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  it('explains in Spanish when the file lives in Drive instead of signing a dead URL', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm === 'entregas.read')
    maybeSingle.mockResolvedValue({
      data: row({ storage_provider: 'drive', drive_file_id: '1DriveFile' }),
      error: null,
    })

    const res = await getVideoDownloadUrl('v1')

    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/google drive/i)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  it('explains in Spanish when the edited row has no storage key', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm === 'entregas.read')
    maybeSingle.mockResolvedValue({
      data: row({ drive_file_id: '' }),
      error: null,
    })

    const res = await getVideoDownloadUrl('v1')

    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/no tiene un archivo descargable/i)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
})
