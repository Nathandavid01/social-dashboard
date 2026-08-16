import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Server actions behind resilient (multipart) uploads. Same permission gate
 * as the existing single-PUT actions (video.upload), and routed by provider
 * exactly like idea-videos-r2.ts (pipeline 'r2') vs entregas-r2.ts
 * ('entregas-r2') — this must NOT collapse the dual-R2 split.
 */

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
}))

const r2Send = vi.fn()
const entregasSend = vi.fn()

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: r2Send })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
}))

vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: vi.fn(() => ({ send: entregasSend })),
  entregasR2Bucket: vi.fn(() => 'nmedia-entregas'),
  isEntregasR2Configured: vi.fn(() => true),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input: { PartNumber?: number } }) =>
    `https://signed/part-${command.input.PartNumber ?? 0}`,
  ),
}))

import { requirePermission } from '@/lib/auth/server'
import {
  startMultipartUpload,
  presignUploadParts,
  completeMultipartUpload,
  abortMultipartUpload,
} from './multipart-upload'

beforeEach(() => {
  vi.clearAllMocks()
  r2Send.mockResolvedValue({ UploadId: 'upload-123' })
  entregasSend.mockResolvedValue({ UploadId: 'upload-456' })
})

describe('startMultipartUpload', () => {
  it('gates on video.upload', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error('No autorizado'))
    const res = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(res.error).toBe('No autorizado')
    expect(r2Send).not.toHaveBeenCalled()
  })

  it('routes an R2 (pipeline) upload to the r2 client and builds an ideas/ key', async () => {
    const res = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(res.error).toBeUndefined()
    expect(res.uploadId).toBe('upload-123')
    expect(res.key).toMatch(/^ideas\/idea-1\/edited\//)
    expect(r2Send).toHaveBeenCalledTimes(1)
    expect(entregasSend).not.toHaveBeenCalled()
  })

  it('routes an entregas-r2 upload to the entregas client and builds an entregas/ key', async () => {
    const res = await startMultipartUpload({ provider: 'entregas-r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(res.error).toBeUndefined()
    expect(res.uploadId).toBe('upload-456')
    expect(res.key).toMatch(/^entregas\/idea-1\/edited\//)
    expect(entregasSend).toHaveBeenCalledTimes(1)
    expect(r2Send).not.toHaveBeenCalled()
  })
})

describe('presignUploadParts', () => {
  it('signs a URL per requested part number, in one batched call', async () => {
    const res = await presignUploadParts({ provider: 'r2', key: 'ideas/idea-1/edited/x.mp4', uploadId: 'upload-123', partNumbers: [1, 2, 3] })
    expect(res.error).toBeUndefined()
    expect(res.urls).toEqual({
      1: 'https://signed/part-1',
      2: 'https://signed/part-2',
      3: 'https://signed/part-3',
    })
  })
})

describe('completeMultipartUpload', () => {
  it('sends parts with their ETags in order', async () => {
    r2Send.mockResolvedValueOnce({}) // CompleteMultipartUploadCommand
    const res = await completeMultipartUpload({
      provider: 'r2',
      key: 'ideas/idea-1/edited/x.mp4',
      uploadId: 'upload-123',
      parts: [{ partNumber: 1, etag: '"e1"' }, { partNumber: 2, etag: '"e2"' }],
    })
    expect(res.ok).toBe(true)
    expect(r2Send).toHaveBeenCalledTimes(1)
    const cmd = r2Send.mock.calls[0][0]
    expect(cmd.input.MultipartUpload.Parts).toEqual([
      { PartNumber: 1, ETag: '"e1"' },
      { PartNumber: 2, ETag: '"e2"' },
    ])
  })
})

describe('abortMultipartUpload', () => {
  it('aborts so no orphaned parts keep paying for storage', async () => {
    entregasSend.mockResolvedValueOnce({})
    const res = await abortMultipartUpload({ provider: 'entregas-r2', key: 'entregas/idea-1/edited/x.mp4', uploadId: 'upload-456' })
    expect(res.ok).toBe(true)
    expect(entregasSend).toHaveBeenCalledTimes(1)
  })

  it('surfaces a Spanish error message when the bucket is not configured', async () => {
    const { isR2Configured } = await import('@/lib/integrations/r2')
    vi.mocked(isR2Configured).mockReturnValueOnce(false)
    const res = await abortMultipartUpload({ provider: 'r2', key: 'ideas/idea-1/edited/x.mp4', uploadId: 'upload-123' })
    expect(res.error).toBe('R2 no está configurado')
  })
})
