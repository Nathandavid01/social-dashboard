import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  r2Public: null as string | null,
  entregasPublic: null as string | null,
  r2Client: { name: 'r2' } as object | null,
  entregasClient: { name: 'ent' } as object | null,
  signed: 'https://signed.example/raw.mp4',
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => h.signed),
}))
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))
vi.mock('@/lib/integrations/r2', () => ({
  r2PublicUrl: () => h.r2Public,
  r2Client: () => h.r2Client,
  r2Bucket: () => 'nmedia-videos',
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  ENTREGAS_PROVIDER: 'entregas-r2',
  entregasR2PublicUrl: () => h.entregasPublic,
  entregasR2Client: () => h.entregasClient,
  entregasR2Bucket: () => 'entregas',
}))

import { listenUrlForCaptionVideo } from './caption-listen-url'

const vid = (over: Partial<Parameters<typeof listenUrlForCaptionVideo>[0]> = {}) => ({
  id: 'v1',
  kind: 'raw',
  status: 'uploaded',
  drive_file_id: 'ideas/1/raw/a.mp4',
  storage_provider: 'r2',
  ...over,
})

describe('listenUrlForCaptionVideo', () => {
  beforeEach(() => {
    h.r2Public = null
    h.entregasPublic = null
    h.r2Client = { name: 'r2' }
    h.entregasClient = { name: 'ent' }
    h.signed = 'https://signed.example/raw.mp4'
  })

  it('uses the public URL for an edited pipeline file', async () => {
    h.r2Public = 'https://videos.example/ideas/1/edited/f.mp4'
    const url = await listenUrlForCaptionVideo(
      vid({ kind: 'edited', drive_file_id: 'ideas/1/edited/f.mp4' }),
    )
    expect(url).toBe('https://videos.example/ideas/1/edited/f.mp4')
  })

  it('presigns raw footage so Whisper can hear it without making it public', async () => {
    const url = await listenUrlForCaptionVideo(vid())
    expect(url).toBe('https://signed.example/raw.mp4')
  })

  it('returns null when there is no file and no client', async () => {
    h.r2Client = null
    expect(await listenUrlForCaptionVideo(vid({ drive_file_id: null }))).toBeNull()
    expect(await listenUrlForCaptionVideo(vid())).toBeNull()
  })
})
