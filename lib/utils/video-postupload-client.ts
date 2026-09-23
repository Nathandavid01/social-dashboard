'use client'

/**
 * Todo lo que corre justo DESPUÉS de subir un video editado, fuera del
 * camino crítico de la subida: dispara el QC IA (mismo POST que
 * analyzeUploadedVideo) Y sube la tira de 5 escenas — reutilizando UNA sola
 * extracción de frames para ambos. Fire-and-forget: nunca lanza ni bloquea.
 *
 * analyzeUploadedVideo sigue existiendo intacto para quien no quiera thumbs.
 */
import { extractVideoFrames, extractVideoFramesFromUrl } from './video-frames-dom'
import { chunkFrames, detectSceneCuts } from './video-frames'
import { postVideoAnalysisChunks } from './video-analysis-chunks'
import { pickThumbFrames, THUMB_COUNT } from './video-thumbs'
import { getThumbUploadUrls, registerVideoThumbs } from '@/lib/actions/video-thumbs'
import { videoFileUrl } from './video-analysis-client'

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri)
  return res.blob()
}

export interface ProcessUploadedVideoDeps {
  /** `frameCount` limita la extracción: la tira necesita 5, el QC IA los 240. */
  extract?: (f: File, frameCount?: number) => Promise<{ frames: string[]; timestamps: number[]; fingerprints?: { t: number; fingerprint: number[] }[] }>
  /** Igual que `extract` pero para un video YA subido (URL de mismo origen). */
  extractFromUrl?: (url: string, frameCount?: number, opts?: { background?: boolean }) => Promise<{ frames: string[]; timestamps: number[] }>
  post?: typeof fetch
  getUploadUrls?: (videoId: string, count: number) => Promise<{ urls?: string[]; keys?: string[]; error?: string }>
  register?: (videoId: string, keys: string[]) => Promise<{ ok?: true; error?: string }>
  putThumb?: (url: string, dataUri: string) => Promise<void>
}

async function analyze(
  videoId: string,
  frames: string[],
  timestamps: number[],
  post: typeof fetch,
  cuts: number[] = [],
): Promise<void> {
  if (frames.length === 0) return
  // Un POST secuencial por chunk (videos largos → varios); los timestamps
  // dejan que la IA reporte el segundo exacto del error.
  await postVideoAnalysisChunks(videoId, chunkFrames(frames, timestamps), post, cuts)
}

async function defaultPutThumb(url: string, dataUri: string): Promise<void> {
  const blob = await dataUriToBlob(dataUri)
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
  // R2 puede rechazar sin lanzar (403 de presign vencido, 5xx) — un PUT
  // "exitoso" que en realidad no subió nada dejaría thumb_keys apuntando
  // a objetos que no existen. Lanzar aquí hace que uploadThumbs() no
  // registre ninguna key de este lote (todo o nada).
  if (!res.ok) throw new Error(`R2 ${res.status} subiendo thumbnail`)
}

function thumbDeps(deps?: ProcessUploadedVideoDeps): Required<Pick<ProcessUploadedVideoDeps, 'getUploadUrls' | 'register' | 'putThumb'>> {
  return {
    getUploadUrls: deps?.getUploadUrls ?? getThumbUploadUrls,
    register: deps?.register ?? registerVideoThumbs,
    putThumb: deps?.putThumb ?? defaultPutThumb,
  }
}

/** Sube y registra la tira. `true` solo si quedó guardada; nunca lanza. */
async function uploadThumbs(
  videoId: string,
  frames: string[],
  deps: Required<Pick<ProcessUploadedVideoDeps, 'getUploadUrls' | 'register' | 'putThumb'>>,
): Promise<boolean> {
  const picked = pickThumbFrames(frames, THUMB_COUNT)
  if (picked.length === 0) return false
  try {
    const slot = await deps.getUploadUrls(videoId, picked.length)
    if (slot.error || !slot.urls || !slot.keys) return false
    await Promise.all(picked.map((dataUri, i) => deps.putThumb(slot.urls![i], dataUri)))
    const res = await deps.register(videoId, slot.keys)
    return !res.error
  } catch {
    // Silencioso a propósito: la tira es un extra visual, nunca bloquea nada.
    return false
  }
}

export async function processUploadedVideo(
  videoId: string,
  file: File,
  deps?: ProcessUploadedVideoDeps,
): Promise<{ analyzed: boolean }> {
  const extract = deps?.extract ?? extractVideoFrames
  const post = deps?.post ?? fetch

  let frames: string[]
  let timestamps: number[]
  let fingerprints: { t: number; fingerprint: number[] }[] | undefined
  try {
    ;({ frames, timestamps, fingerprints } = await extract(file))
  } catch {
    // Silencioso: el navegador no pudo decodificar el video — ni análisis ni thumbs.
    return { analyzed: false }
  }
  if (frames.length === 0) return { analyzed: false }

  const cuts = fingerprints ? detectSceneCuts(fingerprints) : []

  // Ambos son independientes: uno puede fallar sin tumbar al otro.
  const [analysisResult] = await Promise.allSettled([
    analyze(videoId, frames, timestamps, post, cuts),
    uploadThumbs(videoId, frames, thumbDeps(deps)),
  ])
  return { analyzed: analysisResult.status === 'fulfilled' }
}

/** Extrae la tira, la guarda y devuelve la primera imagen. Nunca lanza. */
async function thumbsFrom(
  videoId: string,
  extract: () => Promise<{ frames: string[] }>,
  deps?: ProcessUploadedVideoDeps,
): Promise<{ cover: string | null; saved: boolean }> {
  let frames: string[]
  try {
    ;({ frames } = await extract())
  } catch {
    // El navegador no pudo decodificar el video: sin carátula, pero el video está a salvo.
    return { cover: null, saved: false }
  }
  if (frames.length === 0) return { cover: null, saved: false }

  const saved = await uploadThumbs(videoId, frames, thumbDeps(deps))
  // pickThumbFrames siempre conserva el primer fotograma: es la carátula.
  return { cover: frames[0], saved }
}

/**
 * Solo la tira de escenas, para los CRUDOS: es lo que le pone carátula al banco
 * de video. No dispara el QC IA — ese es del corte final y se cobra por
 * fotograma. Extrae únicamente los 5 que la tira necesita en vez de los 240 del
 * análisis, que en un crudo de tres minutos sería tirar 235 a la basura.
 *
 * Fire-and-forget como el resto: nunca lanza ni bloquea la subida.
 */
export async function generateVideoThumbs(
  videoId: string,
  file: File,
  deps?: ProcessUploadedVideoDeps,
): Promise<void> {
  const extract = deps?.extract ?? extractVideoFrames
  await thumbsFrom(videoId, () => extract(file, THUMB_COUNT), deps)
}

/**
 * Carátula para un video YA subido que se quedó sin ella (la pestaña se cerró
 * antes de generarla, o el browser no dio abasto): 27 de 134 crudos en prod
 * (sep-2026) y nada las recuperaba. Lee el video por el proxy de mismo origen
 * (`videoFileUrl`, así el canvas se puede leer) y guarda la tira como al subir.
 *
 * Devuelve la primera imagen para pintarla ya, aunque no se haya podido
 * guardar (p.ej. quien mira no tiene permiso de subir). Nunca lanza.
 */
export function healVideoThumbs(
  videoId: string,
  deps?: ProcessUploadedVideoDeps,
): Promise<{ cover: string | null; saved: boolean }> {
  const extract = deps?.extractFromUrl ?? extractVideoFramesFromUrl
  // De fondo: una carátula vieja nunca adelanta a la de lo que se está subiendo.
  return thumbsFrom(videoId, () => extract(videoFileUrl(videoId), THUMB_COUNT, { background: true }), deps)
}
