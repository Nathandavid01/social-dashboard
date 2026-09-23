import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The upload engine lives in the store, not in a component: startUpload
 * kicks off the work and it runs to completion (or error/cancel) regardless
 * of whether anything is subscribed/mounted. These tests exercise the whole
 * flow against mocked server actions + mocked HTTP PUT, with `sleep` and
 * `backoffDelayMs` stubbed so retries don't actually wait.
 */

vi.mock('@/lib/utils/sleep', () => ({ sleep: vi.fn(async () => {}) }))

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'ideas/idea-1/edited/x.mp4' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'video-1' })),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregasUploadUrl: vi.fn(async () => ({ url: 'https://entregas/put', key: 'entregas/idea-1/edited/x.mp4' })),
  registerEntregasVideo: vi.fn(async () => ({ ok: true, id: 'video-2' })),
}))
vi.mock('@/lib/actions/multipart-upload', () => ({
  startMultipartUpload: vi.fn(async () => ({ uploadId: 'up-1', key: 'ideas/idea-1/edited/big.mp4' })),
  presignUploadParts: vi.fn(async (input: { partNumbers: number[] }) => ({
    urls: Object.fromEntries(input.partNumbers.map((n) => [n, `https://r2/part-${n}`])),
  })),
  completeMultipartUpload: vi.fn(async () => ({ ok: true })),
  abortMultipartUpload: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/actions/video-dedupe', () => ({
  findDuplicateVideo: vi.fn(async () => null),
  rememberVideoFingerprint: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn(async () => ({ analyzed: true })),
  generateVideoThumbs: vi.fn(async () => {}),
}))

const putBlobMock = vi.fn(async (_url: string, _blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void; signal?: AbortSignal }) => {
  opts?.onProgress?.((_blob as Blob).size)
  return { etag: '"etag"' }
})
vi.mock('@/lib/utils/upload-http', () => ({ putBlob: (...args: Parameters<typeof putBlobMock>) => putBlobMock(...args) }))

import { useUploadStore, MAX_PARALLEL_UPLOADS, TERMINAL_UPLOAD_PHASES } from './upload-store'
import { getR2UploadUrl, registerR2Video } from '@/lib/actions/idea-videos-r2'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { startMultipartUpload, completeMultipartUpload, abortMultipartUpload, presignUploadParts } from '@/lib/actions/multipart-upload'
import { generateVideoThumbs, processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { findDuplicateVideo, rememberVideoFingerprint } from '@/lib/actions/video-dedupe'
import { PART_SIZE_BYTES } from '@/lib/utils/upload-parts'

function smallFile(name = 'clip.mp4', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type: 'video/mp4' })
}

function bigFile(name = 'big.mp4', bytes = PART_SIZE_BYTES * 2 + 1000): File {
  return new File([new Uint8Array(bytes)], name, { type: 'video/mp4' })
}

async function waitForPhase(id: string, phases: string[], timeoutMs = 2000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const item = useUploadStore.getState().uploads[id]
    if (item && phases.includes(item.phase)) return item
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`Timed out waiting for phase in [${phases.join(', ')}], last: ${JSON.stringify(useUploadStore.getState().uploads[id])}`)
}

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  // La cola de subidas vive en el módulo: una subida que un test dejó esperando
  // turno o internet ocuparía los turnos del siguiente. Se cancelan todas.
  const { uploads, cancelUpload } = useUploadStore.getState()
  for (const [id, u] of Object.entries(uploads)) {
    if (!TERMINAL_UPLOAD_PHASES.has(u.phase)) cancelUpload(id)
  }
  vi.clearAllMocks()
  // clearAllMocks no borra los mockImplementationOnce sin consumir (p.ej. el
  // startMultipartUpload diferido del test de cancelar en "preparando"): se
  // restablecen los multipart para que ningún test herede uno colgado.
  vi.mocked(getR2UploadUrl).mockReset().mockImplementation(async () => ({ url: 'https://r2/put', key: 'ideas/idea-1/edited/x.mp4' }))
  vi.mocked(startMultipartUpload).mockReset().mockImplementation(async () => ({ uploadId: 'up-1', key: 'ideas/idea-1/edited/big.mp4' }))
  vi.mocked(presignUploadParts).mockReset().mockImplementation(async (input: { partNumbers: number[] }) => ({
    urls: Object.fromEntries(input.partNumbers.map((n) => [n, `https://r2/part-${n}`])),
  }))
  putBlobMock.mockImplementation(async (_url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
    opts?.onProgress?.(blob.size)
    return { etag: '"etag"' }
  })
  useUploadStore.setState({ uploads: {} })
})

describe('upload-store — small file (single PUT)', () => {
  it('goes preparando → subiendo → registrando → listo, registers the video and analyzes it', async () => {
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })

    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(item.pct).toBe(100)
    expect(item.videoId).toBe('video-1')
    expect(vi.mocked(getR2UploadUrl)).toHaveBeenCalledWith(
      expect.objectContaining({ ideaId: 'idea-1', kind: 'edited', fileName: 'clip.mp4' }),
    )
    expect(vi.mocked(registerR2Video)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('video-1', file)
  })

  it('un crudo genera su carátula, y no el QC IA', async () => {
    // El banco de video se ve por la carátula del crudo; el QC IA es del corte
    // final y se cobra por fotograma.
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'raw', provider: 'r2' })

    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(vi.mocked(generateVideoThumbs)).toHaveBeenCalledWith('video-1', file)
    expect(vi.mocked(processUploadedVideo)).not.toHaveBeenCalled()
  })

  it('el b-roll también trae carátula', async () => {
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'broll', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])
    expect(vi.mocked(generateVideoThumbs)).toHaveBeenCalledWith('video-1', file)
  })

  it('un editado sigue yendo al QC IA, no a la carátula sola', async () => {
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])
    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('video-1', file)
    expect(vi.mocked(generateVideoThumbs)).not.toHaveBeenCalled()
  })

  it('si la carátula del crudo falla, la subida igual queda lista', async () => {
    vi.mocked(generateVideoThumbs).mockRejectedValueOnce(new Error('sin decodificador'))
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(item.pct).toBe(100)
  })

  it('el dock y el registro usan el título de la idea, no IMG_8841', async () => {
    const file = smallFile('IMG_8841.MOV')
    const id = useUploadStore.getState().startUpload({
      file, ideaId: 'idea-1', kind: 'raw', provider: 'r2', title: 'El primer sandwich del día',
    })
    expect(useUploadStore.getState().uploads[id].fileName).toBe('El primer sandwich del día.MOV')
    await waitForPhase(id, ['listo', 'error'])
    expect(vi.mocked(registerR2Video)).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'El primer sandwich del día.MOV' }),
    )
  })

  it('routes entregas-r2 uploads through the entregas actions, not the pipeline ones', async () => {
    const file = smallFile('final.mp4')
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-9', kind: 'edited', provider: 'entregas-r2' })
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(vi.mocked(registerEntregasVideo)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(registerR2Video)).not.toHaveBeenCalled()
  })

  it('does not trigger AI analysis for raw/broll uploads', async () => {
    const file = smallFile('raw.mp4')
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])
    expect(vi.mocked(processUploadedVideo)).not.toHaveBeenCalled()
  })
})

describe('upload-store — a part fails then recovers', () => {
  it('one part fails twice and then succeeds — the upload still completes, attempt reflects the retry', async () => {
    let calls = 0
    putBlobMock.mockImplementation(async (url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      if (url.includes('part-1')) {
        calls++
        if (calls <= 2) throw new Error('Falla de red simulada')
      }
      opts?.onProgress?.(blob.size)
      return { etag: `"etag-${url}"` }
    })

    const file = bigFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error'])

    expect(item.phase).toBe('listo')
    expect(item.attempt).toBeGreaterThanOrEqual(3)
    expect(vi.mocked(completeMultipartUpload)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(registerR2Video)).toHaveBeenCalledTimes(1)
  })
})

describe('upload-store — un part reintentando no debe "parpadear" el estado general', () => {
  it('the overall phase settles into "reintentando" once, not repeatedly toggling with "subiendo" as other parts dequeue/succeed around it', async () => {
    let part1FirstTry = true
    putBlobMock.mockImplementation(async (url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      if (url.includes('part-1') && part1FirstTry) {
        part1FirstTry = false
        throw new Error('Falla de red simulada')
      }
      opts?.onProgress?.(blob.size)
      return { etag: `"etag-${url}"` }
    })

    // 5 parts / concurrency 3: after part-1 fails, workers keep dequeuing
    // part-4 and part-5 while part-1 is still "reintentando" — under the old
    // code, each of THOSE parts starting their first attempt overwrote the
    // shared phase back to "subiendo", flickering.
    const file = new File([new Uint8Array(PART_SIZE_BYTES * 5)], 'five-parts.mp4', { type: 'video/mp4' })
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    const seenPhases: string[] = []
    const unsub = useUploadStore.subscribe((s) => {
      const p = s.uploads[id]?.phase
      if (p && seenPhases[seenPhases.length - 1] !== p) seenPhases.push(p)
    })
    const item = await waitForPhase(id, ['listo', 'error'])
    unsub()

    expect(item.phase).toBe('listo')
    expect(seenPhases.filter((p) => p === 'reintentando')).toHaveLength(1)
  })

  it('a failed part does not leave its stale in-flight bytes counted in pct after it starts retrying', async () => {
    let part1FirstTry = true
    putBlobMock.mockImplementation(async (url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      if (url.includes('part-1') && part1FirstTry) {
        part1FirstTry = false
        opts?.onProgress?.(Math.floor(blob.size / 2)) // reports progress, THEN fails
        throw new Error('Falla de red simulada')
      }
      opts?.onProgress?.(blob.size)
      return { etag: `"etag-${url}"` }
    })

    let pctAtFirstRetry: number | null = null
    const file = new File([new Uint8Array(PART_SIZE_BYTES * 3)], 'three-parts.mp4', { type: 'video/mp4' })
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    const unsub = useUploadStore.subscribe((s) => {
      const it = s.uploads[id]
      if (it?.phase === 'reintentando' && pctAtFirstRetry === null) pctAtFirstRetry = it.pct
    })
    const item = await waitForPhase(id, ['listo', 'error'])
    unsub()

    expect(item.phase).toBe('listo')
    // part-1 had reported ~half its bytes before failing; once marked
    // retrying, that half must be dropped from the aggregate immediately —
    // it can't still count toward pct while part-1 sits at 0 bytes resent.
    expect(pctAtFirstRetry).not.toBeNull()
    expect(pctAtFirstRetry as unknown as number).toBeLessThanOrEqual(67) // <= the 2 healthy parts' share (~66.7%)
  })
})

describe('upload-store — a part exhausts all retries', () => {
  it('stops after 5 attempts, ends in error, aborts server-side, and never registers the video', async () => {
    putBlobMock.mockImplementation(async (url: string) => {
      if (url.includes('part-1')) throw new Error('Siempre falla')
      return { etag: `"etag-${url}"` }
    })

    const file = bigFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    const item = await waitForPhase(id, ['error'])

    expect(item.phase).toBe('error')
    expect(item.error).toBeTruthy()
    expect(vi.mocked(registerR2Video)).not.toHaveBeenCalled()
    expect(vi.mocked(abortMultipartUpload)).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'r2', uploadId: 'up-1' }),
    )
  })
})

describe('upload-store — cancelar', () => {
  it('aborts in-flight requests and calls the server-side multipart abort exactly once', async () => {
    let releasePart1: (() => void) | null = null
    putBlobMock.mockImplementation(async (url: string, blob: Blob, _ct: string, opts?: { signal?: AbortSignal }) => {
      if (url.includes('part-1')) {
        return new Promise((resolve, reject) => {
          releasePart1 = () => reject(new DOMException('Aborted', 'AbortError'))
          opts?.signal?.addEventListener('abort', () => releasePart1?.())
        })
      }
      return { etag: `"etag-${url}"` }
    })

    const file = bigFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    await waitForPhase(id, ['subiendo', 'reintentando'])

    useUploadStore.getState().cancelUpload(id)
    const item = await waitForPhase(id, ['cancelado'])

    expect(item.phase).toBe('cancelado')
    expect(vi.mocked(startMultipartUpload)).toHaveBeenCalled()
    expect(vi.mocked(abortMultipartUpload)).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'r2', uploadId: 'up-1' }),
    )
    expect(vi.mocked(abortMultipartUpload)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(registerR2Video)).not.toHaveBeenCalled()
  })

  it('cancelling during "preparando" (mientras se calcula la huella) no abre ningún multipart en R2', async () => {
    const started = deferred<{ uploadId: string; key: string }>()
    vi.mocked(startMultipartUpload).mockImplementationOnce(() => started.promise)

    const file = bigFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    // La huella y la comprobación de duplicado van ANTES de startMultipartUpload:
    // cancelar aquí significa que nunca llega a abrirse nada que haya que abortar.
    useUploadStore.getState().cancelUpload(id)
    expect(useUploadStore.getState().uploads[id].phase).toBe('cancelado')
    await new Promise((r) => setTimeout(r, 30))
    expect(vi.mocked(startMultipartUpload)).not.toHaveBeenCalled()
    expect(vi.mocked(abortMultipartUpload)).not.toHaveBeenCalled()
    expect(vi.mocked(registerR2Video)).not.toHaveBeenCalled()
  })
})

describe('upload-store — sobrevive a que nadie esté "montado"', () => {
  it('the upload keeps advancing through phases purely via the store, with no React component involved', async () => {
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })

    // No component ever subscribes/renders here — reading raw store state,
    // the way navigating away and the dock re-mounting elsewhere would.
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
  })
})

describe('upload-store — nunca se sube un video repetido', () => {
  it('si la huella ya existe, no sube nada y termina en "duplicado" con el detalle', async () => {
    vi.mocked(findDuplicateVideo).mockResolvedValueOnce({
      videoId: 'vid-9', kind: 'edited', fileName: 'final.mp4', uploadedAt: '2026-08-28T15:00:00Z',
      ideaId: 'idea-9', ideaTitle: 'Intro clínica', clientName: 'ARASIBO', uploadedBy: 'Carlos',
    })
    const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    const item = await waitForPhase(id, ['duplicado', 'listo', 'error'])
    expect(item.phase).toBe('duplicado')
    expect(item.error).toMatch(/Intro clínica/)
    expect(item.error).toMatch(/ARASIBO/)
    expect(item.duplicateOf).toEqual(expect.objectContaining({ ideaId: 'idea-9', videoId: 'vid-9' }))
    expect(vi.mocked(getR2UploadUrl)).not.toHaveBeenCalled()
    expect(vi.mocked(registerR2Video)).not.toHaveBeenCalled()
    expect(useUploadStore.getState().hasActiveUploads()).toBe(false)
  })

  it('si no hay duplicado, sube y anota la huella del video registrado', async () => {
    const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])
    expect(vi.mocked(findDuplicateVideo)).toHaveBeenCalledWith(expect.stringMatching(/^v1-1024-[0-9a-f]{64}$/))
    expect(vi.mocked(rememberVideoFingerprint)).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'video-1', sizeBytes: 1024, fingerprint: expect.stringMatching(/^v1-1024-/) }),
    )
  })

  it('si la comprobación falla, la subida sigue (nunca bloquea por un error nuestro)', async () => {
    vi.mocked(findDuplicateVideo).mockRejectedValueOnce(new Error('red'))
    const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error', 'duplicado'])
    expect(item.phase).toBe('listo')
  })
})

describe('upload-store — el post-proceso (QC IA / carátula) no bloquea "listo"', () => {
  it('un editado queda "listo" en cuanto se registra; el QC IA sigue en segundo plano', async () => {
    const qc = deferred<{ analyzed: boolean }>()
    vi.mocked(processUploadedVideo).mockReturnValueOnce(qc.promise)
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })

    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(item.pct).toBe(100)
    expect(item.postprocess).toBe('pendiente')
    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('video-1', file)

    qc.resolve({ analyzed: true })
    await new Promise((r) => setTimeout(r, 10))
    expect(useUploadStore.getState().uploads[id].postprocess).toBe('listo')
    expect(useUploadStore.getState().uploads[id].phase).toBe('listo')
  })

  it('si el QC IA falla, la subida sigue "listo" y el post-proceso marca error', async () => {
    const qc = deferred<{ analyzed: boolean }>()
    vi.mocked(processUploadedVideo).mockReturnValueOnce(qc.promise)
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])

    qc.reject(new Error('xAI caído'))
    await new Promise((r) => setTimeout(r, 10))
    const item = useUploadStore.getState().uploads[id]
    expect(item.phase).toBe('listo')
    expect(item.postprocess).toBe('error')
  })

  it('un crudo también queda "listo" antes de su carátula', async () => {
    const thumbs = deferred()
    vi.mocked(generateVideoThumbs).mockReturnValueOnce(thumbs.promise)
    const file = smallFile()
    const id = useUploadStore.getState().startUpload({ file, ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.postprocess).toBe('pendiente')
    thumbs.resolve()
    await new Promise((r) => setTimeout(r, 10))
    expect(useUploadStore.getState().uploads[id].postprocess).toBe('listo')
  })

  it('hasActiveUploads es false mientras solo queda post-proceso pendiente (no hay que avisar al cerrar la pestaña)', async () => {
    const qc = deferred<{ analyzed: boolean }>()
    vi.mocked(processUploadedVideo).mockReturnValueOnce(qc.promise)
    const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'edited', provider: 'r2' })
    await waitForPhase(id, ['listo', 'error'])
    expect(useUploadStore.getState().hasActiveUploads()).toBe(false)
    qc.resolve({ analyzed: true })
  })
})

describe('upload-store — cola: pocos archivos a la vez (el primero aparece rápido)', () => {
  /** putBlob que se queda colgado hasta que el test lo suelte, uno por llamada. */
  function holdPuts() {
    const held: Array<{ url: string; release: () => void; fail: (e: Error) => void }> = []
    putBlobMock.mockImplementation((url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void; signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        held.push({
          url,
          release: () => { opts?.onProgress?.(blob.size); resolve({ etag: '"etag"' }) },
          fail: reject,
        })
        opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    )
    return held
  }

  async function until(check: () => boolean, timeoutMs = 2000) {
    const start = Date.now()
    while (!check()) {
      if (Date.now() - start > timeoutMs) throw new Error('timeout esperando condición')
      await new Promise((r) => setTimeout(r, 5))
    }
  }

  it(`con 4 archivos solo ${MAX_PARALLEL_UPLOADS} suben a la vez; los demás quedan "en-cola" y entran en orden`, async () => {
    const held = holdPuts()
    const start = useUploadStore.getState().startUpload
    const ids = ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4'].map((name) =>
      start({ file: smallFile(name), ideaId: 'idea-1', kind: 'raw', provider: 'r2' }),
    )

    await until(() => held.length === MAX_PARALLEL_UPLOADS)
    await new Promise((r) => setTimeout(r, 20))
    expect(held).toHaveLength(MAX_PARALLEL_UPLOADS)
    expect(vi.mocked(getR2UploadUrl)).toHaveBeenCalledTimes(MAX_PARALLEL_UPLOADS)
    const phases = () => ids.map((id) => useUploadStore.getState().uploads[id].phase)
    expect(phases().slice(MAX_PARALLEL_UPLOADS)).toEqual(['en-cola', 'en-cola'])
    // Esperar turno sigue siendo "subida activa": cerrar la pestaña la mataría.
    expect(useUploadStore.getState().hasActiveUploads()).toBe(true)

    held[0].release()
    await waitForPhase(ids[0], ['listo'])
    await until(() => held.length === MAX_PARALLEL_UPLOADS + 1)
    // Entra el que llegó primero a la fila (c), no cualquiera.
    expect(vi.mocked(getR2UploadUrl).mock.calls[MAX_PARALLEL_UPLOADS][0]).toMatchObject({ fileName: 'c.mp4' })
    expect(useUploadStore.getState().uploads[ids[3]].phase).toBe('en-cola')

    // Soltar el resto, en el orden en que van llegando a R2.
    for (let i = 1; i < 4; i++) {
      await until(() => held.length > i)
      held[i].release()
    }
    for (const id of ids) await waitForPhase(id, ['listo'])
  })

  it('cancelar uno que espera en la fila: queda "cancelado" sin abrir nada en R2', async () => {
    const held = holdPuts()
    const start = useUploadStore.getState().startUpload
    const ids = ['a.mp4', 'b.mp4', 'c.mp4'].map((name) =>
      start({ file: smallFile(name), ideaId: 'idea-1', kind: 'raw', provider: 'r2' }),
    )
    await waitForPhase(ids[2], ['en-cola'])

    useUploadStore.getState().cancelUpload(ids[2])
    await waitForPhase(ids[2], ['cancelado'])

    await until(() => held.length === 2)
    held.forEach((h) => h.release())
    await waitForPhase(ids[0], ['listo'])
    await waitForPhase(ids[1], ['listo'])
    await new Promise((r) => setTimeout(r, 20))
    expect(vi.mocked(getR2UploadUrl)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(registerR2Video)).toHaveBeenCalledTimes(2)
  })

  it('una subida que falla suelta su turno: el siguiente de la fila arranca', async () => {
    // Atado al archivo, no al orden de llamada: cuál pide URL primero depende
    // de cuánto tarda la huella de cada uno (en CI no siempre es a.mp4).
    vi.mocked(getR2UploadUrl).mockImplementation(async (input: { fileName: string }) =>
      input.fileName === 'a.mp4' ? ({ error: 'R2 caído' } as never) : { url: 'https://r2/put', key: 'ideas/idea-1/edited/x.mp4' },
    )
    const held = holdPuts()
    const start = useUploadStore.getState().startUpload
    const ids = ['a.mp4', 'b.mp4', 'c.mp4'].map((name) =>
      start({ file: smallFile(name), ideaId: 'idea-1', kind: 'raw', provider: 'r2' }),
    )
    await waitForPhase(ids[0], ['error'])
    await until(() => held.length === 2)
    held.forEach((h) => h.release())
    await waitForPhase(ids[1], ['listo'])
    await waitForPhase(ids[2], ['listo'])
  })
})

describe('upload-store — si se va el internet, espera en vez de fallar', () => {
  it('se va el internet a mitad de la subida: no gasta intentos, espera y sigue sola cuando vuelve', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    let calls = 0
    putBlobMock.mockImplementation(async (_url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      calls++
      if (calls === 1) {
        online.mockReturnValue(false)
        throw Object.assign(new Error('Error de red durante la subida'), { name: 'UploadNetworkError' })
      }
      opts?.onProgress?.(blob.size)
      return { etag: '"etag"' }
    })
    try {
      const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })

      const start = Date.now()
      while (!useUploadStore.getState().uploads[id].offline) {
        if (Date.now() - start > 2000) throw new Error('nunca marcó "sin internet"')
        await new Promise((r) => setTimeout(r, 5))
      }
      // Mientras no vuelva la conexión, no se reintenta a ciegas.
      await new Promise((r) => setTimeout(r, 30))
      expect(calls).toBe(1)
      expect(useUploadStore.getState().uploads[id].phase).toBe('reintentando')

      online.mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
      const item = await waitForPhase(id, ['listo', 'error'])
      expect(item.phase).toBe('listo')
      expect(item.offline).toBeFalsy()
      // El intento que se cayó por falta de internet no cuenta contra los 5.
      expect(item.attempt).toBe(1)
    } finally {
      online.mockRestore()
    }
  })

  it('cancelar mientras espera el internet: termina "cancelado"', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    putBlobMock.mockImplementation(async () => { throw new Error('Error de red durante la subida') })
    try {
      const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
      const start = Date.now()
      while (!useUploadStore.getState().uploads[id].offline) {
        if (Date.now() - start > 2000) throw new Error('nunca marcó "sin internet"')
        await new Promise((r) => setTimeout(r, 5))
      }
      useUploadStore.getState().cancelUpload(id)
      const item = await waitForPhase(id, ['cancelado'])
      expect(item.phase).toBe('cancelado')
    } finally {
      online.mockRestore()
    }
  })
})

describe('upload-store — la consulta de duplicado también espera turno', () => {
  it('los archivos en cola no consultan al servidor hasta que les toca (Next corre las server actions de una en una)', async () => {
    const held: Array<() => void> = []
    putBlobMock.mockImplementation((_url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) =>
      new Promise((resolve) => {
        held.push(() => { opts?.onProgress?.(blob.size); resolve({ etag: '"etag"' }) })
      }),
    )
    const start = useUploadStore.getState().startUpload
    const ids = ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4'].map((name) =>
      start({ file: smallFile(name), ideaId: 'idea-1', kind: 'raw', provider: 'r2' }),
    )
    const t0 = Date.now()
    while (held.length < MAX_PARALLEL_UPLOADS) {
      if (Date.now() - t0 > 2000) throw new Error('timeout')
      await new Promise((r) => setTimeout(r, 5))
    }
    await new Promise((r) => setTimeout(r, 20))
    expect(vi.mocked(findDuplicateVideo)).toHaveBeenCalledTimes(MAX_PARALLEL_UPLOADS)

    const t1 = Date.now()
    while (held.length < ids.length) {
      if (Date.now() - t1 > 2000) throw new Error('timeout')
      held.forEach((release) => release())
      await new Promise((r) => setTimeout(r, 5))
    }
    held.forEach((release) => release())
    for (const id of ids) await waitForPhase(id, ['listo'])
    expect(vi.mocked(findDuplicateVideo)).toHaveBeenCalledTimes(ids.length)
  })
})

describe('upload-store — review: la cola aguanta de verdad sin internet', () => {
  function networkError() {
    const e = new Error('Error de red durante la subida')
    e.name = 'UploadNetworkError'
    return e
  }

  it('sin internet, los archivos en cola no arrancan uno tras otro para caerse en cascada: esperan', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      const start = useUploadStore.getState().startUpload
      const ids = ['a.mp4', 'b.mp4', 'c.mp4'].map((name) =>
        start({ file: smallFile(name), ideaId: 'idea-1', kind: 'raw', provider: 'r2' }),
      )
      await new Promise((r) => setTimeout(r, 30))
      expect(vi.mocked(getR2UploadUrl)).not.toHaveBeenCalled()
      expect(vi.mocked(findDuplicateVideo)).not.toHaveBeenCalled()
      const items = ids.map((id) => useUploadStore.getState().uploads[id])
      expect(items.some((i) => i.phase === 'error')).toBe(false)
      expect(items[0].offline).toBe(true)

      online.mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
      for (const id of ids) await waitForPhase(id, ['listo'])
    } finally {
      online.mockRestore()
    }
  })

  it('wifi conectado pero sin internet: los errores de red se reintentan por tiempo, no se agotan en 5 intentos', async () => {
    let calls = 0
    putBlobMock.mockImplementation(async (_url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      calls++
      if (calls <= 8) throw networkError()
      opts?.onProgress?.(blob.size)
      return { etag: '"etag"' }
    })
    const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(calls).toBe(9)
    expect(item.offline).toBeFalsy()
  })

  it('pasados varios minutos sin red, sí se rinde (no se queda colgada para siempre)', async () => {
    let clock = 1_000_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock)
    putBlobMock.mockImplementation(async () => {
      clock += 2 * 60_000
      throw networkError()
    })
    try {
      const id = useUploadStore.getState().startUpload({ file: smallFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
      // waitForPhase mide su timeout con Date.now, que aquí está falseado: se sondea por vueltas.
      for (let i = 0; i < 400 && !['listo', 'error'].includes(useUploadStore.getState().uploads[id].phase); i++) {
        await new Promise((r) => setTimeout(r, 5))
      }
      expect(useUploadStore.getState().uploads[id].phase).toBe('error')
    } finally {
      now.mockRestore()
    }
  })

  it('una parte con la URL vencida (403 tras una espera larga): se vuelve a firmar esa parte y la subida sigue', async () => {
    let first403 = true
    putBlobMock.mockImplementation(async (url: string, blob: Blob, _ct: string, opts?: { onProgress?: (n: number) => void }) => {
      if (url === 'https://r2/part-1' && first403) {
        first403 = false
        throw Object.assign(new Error('HTTP 403'), { name: 'UploadHttpError', status: 403 })
      }
      opts?.onProgress?.(blob.size)
      return { etag: `"etag-${url}"` }
    })
    vi.mocked(presignUploadParts).mockImplementation(async (input: { partNumbers: number[] }) => ({
      urls: Object.fromEntries(input.partNumbers.map((n) => [n, first403 ? `https://r2/part-${n}` : `https://r2/part-${n}?fresca`])),
    }))

    const id = useUploadStore.getState().startUpload({ file: bigFile(), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const item = await waitForPhase(id, ['listo', 'error'])
    expect(item.phase).toBe('listo')
    expect(vi.mocked(presignUploadParts)).toHaveBeenLastCalledWith(expect.objectContaining({ partNumbers: [1] }))
    expect(putBlobMock.mock.calls.some(([url]) => url === 'https://r2/part-1?fresca')).toBe(true)
  })

  it('una tanda nueva empieza su propio conteo: lo que ya terminó antes no es parte de ella', async () => {
    const start = useUploadStore.getState().startUpload
    const old = start({ file: smallFile('viejo.mp4'), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    await waitForPhase(old, ['listo'])
    const a = start({ file: smallFile('a.mp4'), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const b = start({ file: smallFile('b.mp4'), ideaId: 'idea-1', kind: 'raw', provider: 'r2' })
    const s = useUploadStore.getState().uploads
    expect(s[a].batch).toBe(s[b].batch)
    expect(s[a].batch).toBeGreaterThan(s[old].batch ?? 0)
    await waitForPhase(a, ['listo'])
    await waitForPhase(b, ['listo'])
  })
})
