import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Server actions behind resilient (multipart) uploads. Same permission gate
 * as the existing single-PUT actions (video.upload), routed by provider
 * exactly like idea-videos-r2.ts (pipeline 'r2') vs entregas-r2.ts
 * ('entregas-r2') — this must NOT collapse the dual-R2 split.
 *
 * Ownership: `video.upload` is shared by owner/supervisor/editor/video, so
 * knowing a { provider, key, uploadId } alone must NOT be enough to complete
 * or abort someone ELSE's upload. Ownership is a DB row (RLS-scoped to
 * created_by = auth.uid()) recorded at start and checked at presign/complete/
 * abort — a foreign uploadId simply doesn't resolve, same as "not found".
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

// --- Supabase mock: an in-memory ownership table, RLS emulated by hand ----
let currentUserId: string | null = 'user-1'
let ownershipRows: Array<{ upload_id: string; key: string; idea_id: string; provider: string; created_by: string }> = []
let insertShouldError = false
const deleteSpy = vi.fn()

function makeSupabaseMock() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: currentUserId ? { id: currentUserId } : null } })) },
    from: vi.fn((table: string) => {
      if (table !== 'multipart_uploads') throw new Error(`unexpected table ${table}`)
      return {
        insert: (payload: { upload_id: string; key: string; idea_id: string; provider: string; created_by: string }) => ({
          then: (resolve: (v: { error: { message: string } | null }) => unknown) => {
            if (insertShouldError) return resolve({ error: { message: 'insert falló' } })
            ownershipRows.push(payload)
            return resolve({ error: null })
          },
        }),
        select: () => ({
          eq: (col: string, val: string) => ({
            eq: (col2: string, val2: string) => ({
              maybeSingle: async () => {
                // RLS: only rows created_by the requester are ever visible.
                const row = ownershipRows.find(
                  (r) => (r as never as Record<string, string>)[col] === val && (r as never as Record<string, string>)[col2] === val2 && r.created_by === currentUserId,
                )
                return { data: row ?? null, error: null }
              },
            }),
          }),
        }),
        delete: () => ({
          eq: (_col: string, val: string) => {
            deleteSpy(val)
            ownershipRows = ownershipRows.filter((r) => !(r.upload_id === val && r.created_by === currentUserId))
            return Promise.resolve({ error: null })
          },
        }),
      }
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => makeSupabaseMock()),
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
  currentUserId = 'user-1'
  ownershipRows = []
  insertShouldError = false
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

  it('records an ownership row for the creating user', async () => {
    const res = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(ownershipRows).toEqual([
      { upload_id: 'upload-123', key: res.key, idea_id: 'idea-1', provider: 'r2', created_by: 'user-1' },
    ])
  })

  it('aborts the just-created R2 multipart if recording ownership fails, and surfaces an error', async () => {
    insertShouldError = true
    r2Send.mockResolvedValueOnce({ UploadId: 'upload-123' }) // create
    r2Send.mockResolvedValueOnce({}) // abort
    const res = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(res.error).toBeTruthy()
    expect(res.uploadId).toBeUndefined()
    expect(r2Send).toHaveBeenCalledTimes(2) // create + abort, no orphan left trying to be used
  })
})

describe('ownership gate on presign/complete/abort', () => {
  async function startOwned() {
    const started = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    return started as { uploadId: string; key: string }
  }

  it('presign succeeds for the owner', async () => {
    const { uploadId, key } = await startOwned()
    const res = await presignUploadParts({ provider: 'r2', key, uploadId, partNumbers: [1, 2] })
    expect(res.error).toBeUndefined()
    expect(res.urls).toEqual({ 1: 'https://signed/part-1', 2: 'https://signed/part-2' })
  })

  it('presign is refused for a DIFFERENT user, even knowing the exact key/uploadId', async () => {
    const { uploadId, key } = await startOwned()
    currentUserId = 'user-2' // a different video.upload-holding user
    const res = await presignUploadParts({ provider: 'r2', key, uploadId, partNumbers: [1] })
    expect(res.error).toBeTruthy()
    expect(res.urls).toBeUndefined()
  })

  it('complete succeeds for the owner and clears the ownership row afterwards', async () => {
    const { uploadId, key } = await startOwned()
    r2Send.mockResolvedValueOnce({}) // CompleteMultipartUploadCommand
    const res = await completeMultipartUpload({ provider: 'r2', key, uploadId, parts: [{ partNumber: 1, etag: '"e1"' }] })
    expect(res.ok).toBe(true)
    expect(deleteSpy).toHaveBeenCalledWith(uploadId)
    expect(ownershipRows).toHaveLength(0)
  })

  it('complete is refused for a DIFFERENT user and never touches R2', async () => {
    const { uploadId, key } = await startOwned()
    currentUserId = 'user-2'
    const res = await completeMultipartUpload({ provider: 'r2', key, uploadId, parts: [{ partNumber: 1, etag: '"e1"' }] })
    expect(res.error).toBeTruthy()
    expect(r2Send).toHaveBeenCalledTimes(1) // only the original create — no complete call went through
  })

  it('abort succeeds for the owner and clears the ownership row', async () => {
    const { uploadId, key } = await startOwned()
    r2Send.mockResolvedValueOnce({}) // AbortMultipartUploadCommand
    const res = await abortMultipartUpload({ provider: 'r2', key, uploadId })
    expect(res.ok).toBe(true)
    expect(deleteSpy).toHaveBeenCalledWith(uploadId)
  })

  it('abort is refused for a DIFFERENT user and never touches R2', async () => {
    const { uploadId, key } = await startOwned()
    currentUserId = 'user-2'
    const res = await abortMultipartUpload({ provider: 'r2', key, uploadId })
    expect(res.error).toBeTruthy()
    expect(r2Send).toHaveBeenCalledTimes(1) // only the original create
  })
})

describe('completeMultipartUpload', () => {
  it('sends parts with their ETags in order', async () => {
    const started = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    r2Send.mockResolvedValueOnce({}) // CompleteMultipartUploadCommand
    const res = await completeMultipartUpload({
      provider: 'r2',
      key: started.key!,
      uploadId: started.uploadId!,
      parts: [{ partNumber: 1, etag: '"e1"' }, { partNumber: 2, etag: '"e2"' }],
    })
    expect(res.ok).toBe(true)
    const cmd = r2Send.mock.calls[1][0]
    expect(cmd.input.MultipartUpload.Parts).toEqual([
      { PartNumber: 1, ETag: '"e1"' },
      { PartNumber: 2, ETag: '"e2"' },
    ])
  })
})

describe('abortMultipartUpload', () => {
  it('surfaces a Spanish error message when the bucket is not configured', async () => {
    const started = await startMultipartUpload({ provider: 'r2', ideaId: 'idea-1', kind: 'edited', fileName: 'a.mp4', contentType: 'video/mp4' })
    const { isR2Configured } = await import('@/lib/integrations/r2')
    vi.mocked(isR2Configured).mockReturnValueOnce(false)
    const res = await abortMultipartUpload({ provider: 'r2', key: started.key!, uploadId: started.uploadId! })
    expect(res.error).toBe('R2 no está configurado')
  })
})
