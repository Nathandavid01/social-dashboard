'use client'

/**
 * Primer Round / Entregas: the file goes straight to R2.
 * Never PUT the bytes through Next/Vercel — that path 413s at ~4.5 MB.
 * Small files: one presigned PUT. Large files: multipart with parallel parts.
 */

import { getEntregasUploadUrl } from '@/lib/actions/entregas-r2'
import {
  abortMultipartUpload,
  completeMultipartUpload,
  presignUploadParts,
  startMultipartUpload,
} from '@/lib/actions/multipart-upload'
import { putBlob } from '@/lib/utils/upload-http'
import {
  aggregateProgress,
  planParts,
  shouldUseMultipart,
} from '@/lib/utils/upload-parts'

/** Browser-typical max connections per host — more parallel parts = faster GFX. */
export const ENTREGAS_FAST_CONCURRENCY = 6

export function isUploadAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

function uploadHttpError(err: unknown): Error {
  if (isUploadAbortError(err)) {
    return err instanceof Error ? err : new DOMException('Aborted', 'AbortError')
  }
  const raw = err instanceof Error ? err.message : 'Error de red durante la subida'
  if (/\b413\b/.test(raw)) {
    return new Error('El video no cabe por el servidor. Se sube directo a Entregas, sin tope de 4.5 MB.')
  }
  return new Error(raw)
}

export async function uploadEntregasFileFast(input: {
  ideaId: string
  file: File
  contentType: string
  signal?: AbortSignal
  onProgress?: (pct: number) => void
}): Promise<{ key: string }> {
  throwIfAborted(input.signal)
  if (shouldUseMultipart(input.file.size)) {
    return uploadMultipart(input)
  }
  return uploadSingle(input)
}

async function uploadSingle(input: {
  ideaId: string
  file: File
  contentType: string
  signal?: AbortSignal
  onProgress?: (pct: number) => void
}): Promise<{ key: string }> {
  const slot = await getEntregasUploadUrl({
    ideaId: input.ideaId,
    fileName: input.file.name,
    contentType: input.contentType,
  })
  throwIfAborted(input.signal)
  if (slot.error || !slot.url || !slot.key) {
    throw new Error(slot.error ?? 'No se pudo preparar la subida')
  }
  try {
    await putBlob(slot.url, input.file, input.contentType, {
      signal: input.signal,
      onProgress: (loaded) => {
        input.onProgress?.(
          aggregateProgress({
            totalBytes: input.file.size,
            completedBytes: 0,
            inFlightBytes: loaded,
          }),
        )
      },
    })
  } catch (err) {
    throw uploadHttpError(err)
  }
  input.onProgress?.(100)
  return { key: slot.key }
}

async function uploadMultipart(input: {
  ideaId: string
  file: File
  contentType: string
  signal?: AbortSignal
  onProgress?: (pct: number) => void
}): Promise<{ key: string }> {
  const started = await startMultipartUpload({
    provider: 'entregas-r2',
    ideaId: input.ideaId,
    kind: 'edited',
    fileName: input.file.name,
    contentType: input.contentType,
  })
  if (started.error || !started.uploadId || !started.key) {
    throw new Error(started.error ?? 'No se pudo iniciar la subida por partes')
  }
  const { uploadId, key } = started

  const abortServer = () => {
    void abortMultipartUpload({ provider: 'entregas-r2', key, uploadId })
  }
  const onAbort = () => abortServer()
  input.signal?.addEventListener('abort', onAbort)

  try {
    throwIfAborted(input.signal)
    const plans = planParts(input.file.size)
    const presigned = await presignUploadParts({
      provider: 'entregas-r2',
      key,
      uploadId,
      partNumbers: plans.map((p) => p.partNumber),
    })
    throwIfAborted(input.signal)
    if (presigned.error || !presigned.urls) {
      throw new Error(presigned.error ?? 'No se pudieron firmar las partes')
    }

    const inFlight = new Map<number, number>()
    let completedBytes = 0
    const parts: { partNumber: number; etag: string }[] = []
    const queue = [...plans]

    const report = () => {
      input.onProgress?.(
        aggregateProgress({
          totalBytes: input.file.size,
          completedBytes,
          inFlightBytes: [...inFlight.values()].reduce((a, b) => a + b, 0),
        }),
      )
    }

    async function worker() {
      while (queue.length > 0) {
        throwIfAborted(input.signal)
        const plan = queue.shift()
        if (!plan) return
        const url = presigned.urls![plan.partNumber]
        if (!url) throw new Error(`Falta la URL de la parte ${plan.partNumber}`)
        const blob = input.file.slice(plan.start, plan.end)
        const result = await putBlob(url, blob, input.contentType, {
          signal: input.signal,
          onProgress: (loaded) => {
            inFlight.set(plan.partNumber, loaded)
            report()
          },
        })
        inFlight.delete(plan.partNumber)
        completedBytes += plan.size
        parts.push({ partNumber: plan.partNumber, etag: result.etag ?? '' })
        report()
      }
    }

    const workers = Math.min(ENTREGAS_FAST_CONCURRENCY, plans.length)
    try {
      await Promise.all(Array.from({ length: workers }, () => worker()))
    } catch (err) {
      throw uploadHttpError(err)
    }

    throwIfAborted(input.signal)
    const done = await completeMultipartUpload({
      provider: 'entregas-r2',
      key,
      uploadId,
      parts,
    })
    if (done.error) throw new Error(done.error)
    input.onProgress?.(100)
    return { key }
  } catch (err) {
    abortServer()
    throw err
  } finally {
    input.signal?.removeEventListener('abort', onAbort)
  }
}
