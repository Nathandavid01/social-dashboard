import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MULTIPART_THRESHOLD_BYTES } from '@/lib/utils/upload-parts'

const putBlob = vi.fn(async () => ({ etag: '"etag-1"' }))
const getEntregasUploadUrl = vi.fn(async () => ({
  url: 'https://entregas.example/put',
  key: 'entregas/new-idea/edited/small.mp4',
}))
const startMultipartUpload = vi.fn(async () => ({
  uploadId: 'up-1',
  key: 'entregas/new-idea/edited/big.mp4',
}))
const presignUploadParts = vi.fn(async (input: { partNumbers: number[] }) => ({
  urls: Object.fromEntries(input.partNumbers.map((n) => [n, `https://entregas.example/part-${n}`])),
}))
const completeMultipartUpload = vi.fn(async () => ({ ok: true }))
const abortMultipartUpload = vi.fn(async () => ({ ok: true }))

vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregasUploadUrl: (...a: unknown[]) => getEntregasUploadUrl(...(a as [])),
}))
vi.mock('@/lib/actions/multipart-upload', () => ({
  startMultipartUpload: (...a: unknown[]) => startMultipartUpload(...(a as [])),
  presignUploadParts: (...a: unknown[]) => presignUploadParts(...(a as [])),
  completeMultipartUpload: (...a: unknown[]) => completeMultipartUpload(...(a as [])),
  abortMultipartUpload: (...a: unknown[]) => abortMultipartUpload(...(a as [])),
}))
vi.mock('@/lib/utils/upload-http', () => ({
  putBlob: (...a: unknown[]) => putBlob(...(a as [])),
}))

import { ENTREGAS_FAST_CONCURRENCY, uploadEntregasFileFast } from './entregas-fast-upload'

function fileOfSize(bytes: number, name = 'clip.mp4') {
  const file = new File(['x'], name, { type: 'video/mp4' })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  putBlob.mockResolvedValue({ etag: '"etag-1"' })
})

describe('uploadEntregasFileFast', () => {
  it('archivos chicos van al presign de Entregas, no a /api/entregas-upload', async () => {
    const file = fileOfSize(1024, 'gfx.mov')
    const res = await uploadEntregasFileFast({
      ideaId: 'new-idea',
      file,
      contentType: 'video/quicktime',
    })
    expect(res.key).toBe('entregas/new-idea/edited/small.mp4')
    expect(getEntregasUploadUrl).toHaveBeenCalledWith({
      ideaId: 'new-idea',
      fileName: 'gfx.mov',
      contentType: 'video/quicktime',
    })
    expect(putBlob).toHaveBeenCalledWith(
      'https://entregas.example/put',
      file,
      'video/quicktime',
      expect.objectContaining({ signal: undefined }),
    )
    expect(startMultipartUpload).not.toHaveBeenCalled()
    const putUrl = vi.mocked(putBlob).mock.calls[0]?.[0] as string
    expect(putUrl).not.toContain('/api/entregas-upload')
  })

  it('archivos grandes suben por partes en paralelo y ensamblan', async () => {
    const file = fileOfSize(MULTIPART_THRESHOLD_BYTES * 2, 'big.mp4')
    const res = await uploadEntregasFileFast({
      ideaId: 'new-idea',
      file,
      contentType: 'video/mp4',
    })
    expect(res.key).toBe('entregas/new-idea/edited/big.mp4')
    expect(getEntregasUploadUrl).not.toHaveBeenCalled()
    expect(startMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'entregas-r2',
        ideaId: 'new-idea',
        kind: 'edited',
        fileName: 'big.mp4',
      }),
    )
    expect(putBlob.mock.calls.length).toBe(2)
    expect(putBlob.mock.calls.map((c) => c[0])).toEqual([
      'https://entregas.example/part-1',
      'https://entregas.example/part-2',
    ])
    expect(completeMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'entregas-r2',
        key: 'entregas/new-idea/edited/big.mp4',
        uploadId: 'up-1',
      }),
    )
  })

  it('no manda más de 6 partes a la vez', async () => {
    let inFlight = 0
    let peak = 0
    let release!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    putBlob.mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await hold
      inFlight -= 1
      return { etag: '"e"' }
    })
    const file = fileOfSize(MULTIPART_THRESHOLD_BYTES * 8, 'huge.mp4')
    const done = uploadEntregasFileFast({ ideaId: 'new-idea', file, contentType: 'video/mp4' })
    await vi.waitFor(() => expect(peak).toBe(ENTREGAS_FAST_CONCURRENCY))
    release()
    await done
    expect(putBlob).toHaveBeenCalledTimes(8)
    expect(peak).toBeLessThanOrEqual(ENTREGAS_FAST_CONCURRENCY)
  })

  it('Detener aborta el multipart en R2', async () => {
    const controller = new AbortController()
    putBlob.mockImplementation(async (_url, _blob, _type, opts: { signal?: AbortSignal }) => {
      controller.abort()
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return { etag: '"e"' }
    })
    const file = fileOfSize(MULTIPART_THRESHOLD_BYTES, 'big.mp4')
    await expect(
      uploadEntregasFileFast({
        ideaId: 'new-idea',
        file,
        contentType: 'video/mp4',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(abortMultipartUpload).toHaveBeenCalledWith({
      provider: 'entregas-r2',
      key: 'entregas/new-idea/edited/big.mp4',
      uploadId: 'up-1',
    })
    expect(completeMultipartUpload).not.toHaveBeenCalled()
  })

  it('un 413 no se traga: avisa que el proxy de Vercel no sirve', async () => {
    putBlob.mockRejectedValueOnce(new Error('HTTP 413'))
    await expect(
      uploadEntregasFileFast({
        ideaId: 'new-idea',
        file: fileOfSize(1024),
        contentType: 'video/mp4',
      }),
    ).rejects.toThrow(/directo a Entregas/i)
  })
})
