'use client'

import { create } from 'zustand'
import type { ContentIdeaVideoKind } from '@/lib/supabase/types'
import { planParts, shouldUseMultipart, backoffDelayMs, aggregateProgress, type UploadPartPlan } from '@/lib/utils/upload-parts'
import { putBlob } from '@/lib/utils/upload-http'
import { sleep } from '@/lib/utils/sleep'
import { getR2UploadUrl, registerR2Video } from '@/lib/actions/idea-videos-r2'
import { getEntregasUploadUrl, registerEntregasVideo } from '@/lib/actions/entregas-r2'
import {
  startMultipartUpload,
  presignUploadParts,
  completeMultipartUpload,
  abortMultipartUpload,
} from '@/lib/actions/multipart-upload'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'

/**
 * The subida-resistente engine — the file survives navigation, tab switches
 * and flaky wifi because it runs HERE, in the store, kicked off by
 * startUpload and driven to completion by plain async functions. No
 * component owns it; unmounting a panel does nothing to an upload in flight.
 *
 * Small files (< 8 MB) use a single PUT, same as before this feature.
 * Larger files go through S3/R2 multipart: up to 3 parts in parallel, each
 * retried up to 5 times with backoff — a flaky connection loses at most one
 * part's progress, never the whole file.
 */

export type UploadPhase =
  | 'preparando'
  | 'subiendo'
  | 'reintentando'
  | 'ensamblando'
  | 'registrando'
  | 'analizando'
  | 'listo'
  | 'error'
  | 'cancelado'

export type UploadProvider = 'r2' | 'entregas-r2'

export interface UploadItem {
  id: string
  fileName: string
  sizeBytes: number
  ideaId: string
  kind: ContentIdeaVideoKind
  provider: UploadProvider
  phase: UploadPhase
  pct: number
  partsDone: number
  partsTotal: number
  attempt: number
  error?: string
  videoId?: string
}

const MAX_ATTEMPTS = 5
const CONCURRENCY = 3

/**
 * Engine-only bookkeeping (File objects, abort controllers, per-part byte
 * counters) kept OUT of the reactive store state — components never need to
 * read these, and File isn't something we want flowing through every
 * selector re-render.
 */
interface Engine {
  file: File
  controller: AbortController
  uploadId?: string
  key?: string
  inFlight?: Map<number, number>
  completedBytes?: number
}
const engines = new Map<string, Engine>()

interface UploadStoreState {
  uploads: Record<string, UploadItem>
  startUpload(input: {
    file: File
    ideaId: string
    kind: ContentIdeaVideoKind
    provider: UploadProvider
  }): string
  /** Aborts in-flight requests and tells the server to abort the multipart upload (no orphaned parts). */
  cancelUpload(id: string): void
  /** Drops a finished/errored/cancelled upload from the dock. */
  dismissUpload(id: string): void
  hasActiveUploads(): boolean
}

let counter = 0
function nextId(): string {
  counter += 1
  return `up-${Date.now()}-${counter}`
}

export const useUploadStore = create<UploadStoreState>((set, get) => ({
  uploads: {},

  startUpload(input) {
    const id = nextId()
    const item: UploadItem = {
      id,
      fileName: input.file.name,
      sizeBytes: input.file.size,
      ideaId: input.ideaId,
      kind: input.kind,
      provider: input.provider,
      phase: 'preparando',
      pct: 0,
      partsDone: 0,
      partsTotal: 0,
      attempt: 0,
    }
    engines.set(id, { file: input.file, controller: new AbortController() })
    set((s) => ({ uploads: { ...s.uploads, [id]: item } }))
    void runEngine(id)
    return id
  },

  cancelUpload(id) {
    const eng = engines.get(id)
    if (!eng) return
    eng.controller.abort()
    patchUpload(id, { phase: 'cancelado' })
    const item = get().uploads[id]
    if (item && eng.uploadId && eng.key) {
      void abortMultipartUpload({ provider: item.provider, key: eng.key, uploadId: eng.uploadId })
    }
  },

  dismissUpload(id) {
    engines.delete(id)
    set((s) => {
      const rest = { ...s.uploads }
      delete rest[id]
      return { uploads: rest }
    })
  },

  hasActiveUploads() {
    return Object.values(get().uploads).some((u) => !['listo', 'error', 'cancelado'].includes(u.phase))
  },
}))

function patchUpload(id: string, changes: Partial<UploadItem>) {
  useUploadStore.setState((s) => {
    const cur = s.uploads[id]
    if (!cur) return s
    return { uploads: { ...s.uploads, [id]: { ...cur, ...changes } } }
  })
}

function isAbortError(err: unknown): boolean {
  return (err instanceof DOMException && err.name === 'AbortError') || (err instanceof Error && err.name === 'AbortError')
}

function sumMap(m: Map<number, number>): number {
  let total = 0
  m.forEach((v) => { total += v })
  return total
}

/** Retries fn up to MAX_ATTEMPTS with exponential backoff + jitter; abort short-circuits immediately. */
async function withRetry<T>(id: string, fn: (attempt: number) => Promise<T>): Promise<T> {
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1
    patchUpload(id, { attempt, phase: attempt === 1 ? 'subiendo' : 'reintentando' })
    try {
      return await fn(attempt)
    } catch (err) {
      if (isAbortError(err)) throw err
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`Se cayó la conexión y no se pudo subir después de ${MAX_ATTEMPTS} intentos`)
      }
      await sleep(backoffDelayMs(attempt))
    }
  }
}

async function uploadWholeFile(id: string, url: string): Promise<void> {
  const eng = engines.get(id)!
  const total = eng.file.size
  await withRetry(id, () =>
    putBlob(url, eng.file, eng.file.type || 'video/mp4', {
      signal: eng.controller.signal,
      onProgress: (loaded) => {
        patchUpload(id, { pct: aggregateProgress({ totalBytes: total, completedBytes: 0, inFlightBytes: loaded }) })
      },
    }),
  )
  patchUpload(id, { pct: 100 })
}

async function uploadPart(id: string, plan: UploadPartPlan, url: string): Promise<{ partNumber: number; etag: string }> {
  const eng = engines.get(id)!
  const total = eng.file.size
  const blob = eng.file.slice(plan.start, plan.end)

  const result = await withRetry(id, () =>
    putBlob(url, blob, eng.file.type || 'video/mp4', {
      signal: eng.controller.signal,
      onProgress: (loaded) => {
        eng.inFlight!.set(plan.partNumber, loaded)
        patchUpload(id, {
          pct: aggregateProgress({ totalBytes: total, completedBytes: eng.completedBytes ?? 0, inFlightBytes: sumMap(eng.inFlight!) }),
        })
      },
    }),
  )

  eng.inFlight!.delete(plan.partNumber)
  eng.completedBytes = (eng.completedBytes ?? 0) + plan.size
  const current = useUploadStore.getState().uploads[id]
  patchUpload(id, {
    partsDone: (current?.partsDone ?? 0) + 1,
    pct: aggregateProgress({ totalBytes: total, completedBytes: eng.completedBytes, inFlightBytes: sumMap(eng.inFlight!) }),
  })
  return { partNumber: plan.partNumber, etag: result.etag ?? '' }
}

async function runSinglePut(id: string): Promise<void> {
  const eng = engines.get(id)!
  const item = useUploadStore.getState().uploads[id]
  const contentType = eng.file.type || 'video/mp4'

  const slot =
    item.provider === 'entregas-r2'
      ? await getEntregasUploadUrl({ ideaId: item.ideaId, fileName: eng.file.name, contentType })
      : await getR2UploadUrl({ ideaId: item.ideaId, kind: item.kind, fileName: eng.file.name, contentType })
  if (slot.error || !slot.url || !slot.key) throw new Error(slot.error ?? 'No se pudo iniciar la subida')
  eng.key = slot.key

  await uploadWholeFile(id, slot.url)

  patchUpload(id, { phase: 'registrando' })
  const res =
    item.provider === 'entregas-r2'
      ? await registerEntregasVideo({ ideaId: item.ideaId, key: slot.key, name: eng.file.name, sizeBytes: eng.file.size, mimeType: contentType })
      : await registerR2Video({ ideaId: item.ideaId, kind: item.kind, key: slot.key, name: eng.file.name, sizeBytes: eng.file.size, mimeType: contentType })
  if (res.error) throw new Error(res.error)

  await finishAfterRegister(id, res.id)
}

async function runMultipart(id: string): Promise<void> {
  const eng = engines.get(id)!
  const item = useUploadStore.getState().uploads[id]
  const contentType = eng.file.type || 'video/mp4'

  const started = await startMultipartUpload({ provider: item.provider, ideaId: item.ideaId, kind: item.kind, fileName: eng.file.name, contentType })
  if (started.error || !started.uploadId || !started.key) throw new Error(started.error ?? 'No se pudo iniciar la subida por partes')
  eng.uploadId = started.uploadId
  eng.key = started.key
  eng.inFlight = new Map()
  eng.completedBytes = 0

  const plans = planParts(eng.file.size)
  patchUpload(id, { partsTotal: plans.length })

  const presigned = await presignUploadParts({
    provider: item.provider,
    key: started.key,
    uploadId: started.uploadId,
    partNumbers: plans.map((p) => p.partNumber),
  })
  if (presigned.error || !presigned.urls) throw new Error(presigned.error ?? 'No se pudieron firmar las partes')
  const urls = presigned.urls

  const queue = [...plans]
  const results: { partNumber: number; etag: string }[] = []
  let queueError: unknown = null

  async function worker() {
    while (queue.length > 0 && !queueError) {
      const plan = queue.shift()!
      try {
        results.push(await uploadPart(id, plan, urls[plan.partNumber]))
      } catch (err) {
        queueError = err
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plans.length) }, () => worker()))
  if (queueError) throw queueError

  patchUpload(id, { phase: 'ensamblando' })
  const done = await completeMultipartUpload({ provider: item.provider, key: started.key, uploadId: started.uploadId, parts: results })
  if (done.error) throw new Error(done.error)

  patchUpload(id, { phase: 'registrando' })
  const res =
    item.provider === 'entregas-r2'
      ? await registerEntregasVideo({ ideaId: item.ideaId, key: started.key, name: eng.file.name, sizeBytes: eng.file.size, mimeType: contentType })
      : await registerR2Video({ ideaId: item.ideaId, kind: item.kind, key: started.key, name: eng.file.name, sizeBytes: eng.file.size, mimeType: contentType })
  if (res.error) throw new Error(res.error)

  await finishAfterRegister(id, res.id)
}

/** After a successful register: fire the AI QC for edited videos (best-effort), then mark done. */
async function finishAfterRegister(id: string, videoId?: string): Promise<void> {
  const eng = engines.get(id)!
  const item = useUploadStore.getState().uploads[id]
  patchUpload(id, { videoId })
  if (item.kind === 'edited' && videoId) {
    patchUpload(id, { phase: 'analizando' })
    try {
      await processUploadedVideo(videoId, eng.file)
    } catch {
      // El video ya está subido y registrado; que falle el análisis no revierte la subida.
    }
  }
  patchUpload(id, { phase: 'listo', pct: 100 })
}

async function runEngine(id: string): Promise<void> {
  const eng = engines.get(id)
  if (!eng) return
  patchUpload(id, { phase: 'preparando' })
  try {
    if (shouldUseMultipart(eng.file.size)) {
      await runMultipart(id)
    } else {
      await runSinglePut(id)
    }
  } catch (err) {
    if (isAbortError(err)) {
      patchUpload(id, { phase: 'cancelado' })
      return
    }
    const message = err instanceof Error ? err.message : 'Error subiendo el video'
    patchUpload(id, { phase: 'error', error: message })
    if (eng.uploadId && eng.key) {
      const item = useUploadStore.getState().uploads[id]
      if (item) void abortMultipartUpload({ provider: item.provider, key: eng.key, uploadId: eng.uploadId })
    }
  }
}
