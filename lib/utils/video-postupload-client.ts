'use client'

/**
 * Todo lo que corre justo DESPUÉS de subir un video editado, fuera del
 * camino crítico de la subida: dispara el QC IA (mismo POST que
 * analyzeUploadedVideo) Y sube la tira de 5 escenas — reutilizando UNA sola
 * extracción de frames para ambos. Fire-and-forget: nunca lanza ni bloquea.
 *
 * analyzeUploadedVideo sigue existiendo intacto para quien no quiera thumbs.
 */
import { extractVideoFrames } from './video-frames-dom'
import { chunkFrames, detectSceneCuts } from './video-frames'
import { postVideoAnalysisChunks } from './video-analysis-chunks'
import type { VideoFormatMeta } from './video-format-rules'
import { pickThumbFrames, THUMB_COUNT } from './video-thumbs'
import { getThumbUploadUrls, registerVideoThumbs } from '@/lib/actions/video-thumbs'

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri)
  return res.blob()
}

export interface ProcessUploadedVideoDeps {
  /** `frameCount` limita la extracción: la tira necesita 5, el QC IA los 240. */
  extract?: (f: File, frameCount?: number) => Promise<{ frames: string[]; timestamps: number[]; fingerprints?: { t: number; fingerprint: number[] }[]; meta?: VideoFormatMeta }>
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
  meta?: VideoFormatMeta,
): Promise<void> {
  if (frames.length === 0) return
  // Un POST secuencial por chunk (videos largos → varios); los timestamps
  // dejan que la IA reporte el segundo exacto del error.
  await postVideoAnalysisChunks(videoId, chunkFrames(frames, timestamps), post, cuts, meta)
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

async function uploadThumbs(
  videoId: string,
  frames: string[],
  deps: Required<Pick<ProcessUploadedVideoDeps, 'getUploadUrls' | 'register' | 'putThumb'>>,
): Promise<void> {
  const picked = pickThumbFrames(frames, THUMB_COUNT)
  if (picked.length === 0) return
  try {
    const slot = await deps.getUploadUrls(videoId, picked.length)
    if (slot.error || !slot.urls || !slot.keys) return
    await Promise.all(picked.map((dataUri, i) => deps.putThumb(slot.urls![i], dataUri)))
    await deps.register(videoId, slot.keys)
  } catch {
    // Silencioso a propósito: la tira es un extra visual, nunca bloquea nada.
  }
}

export async function processUploadedVideo(
  videoId: string,
  file: File,
  deps?: ProcessUploadedVideoDeps,
): Promise<void> {
  const extract = deps?.extract ?? extractVideoFrames
  const post = deps?.post ?? fetch
  const getUploadUrls = deps?.getUploadUrls ?? getThumbUploadUrls
  const register = deps?.register ?? registerVideoThumbs
  const putThumb = deps?.putThumb ?? defaultPutThumb

  let frames: string[]
  let timestamps: number[]
  let fingerprints: { t: number; fingerprint: number[] }[] | undefined
  let meta: VideoFormatMeta | undefined
  try {
    ;({ frames, timestamps, fingerprints, meta } = await extract(file))
  } catch {
    // Silencioso: el navegador no pudo decodificar el video — ni análisis ni thumbs.
    return
  }
  if (frames.length === 0) return

  const cuts = fingerprints ? detectSceneCuts(fingerprints) : []

  // Ambos son independientes: uno puede fallar sin tumbar al otro.
  await Promise.allSettled([
    analyze(videoId, frames, timestamps, post, cuts, meta),
    uploadThumbs(videoId, frames, { getUploadUrls, register, putThumb }),
  ])
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
  const getUploadUrls = deps?.getUploadUrls ?? getThumbUploadUrls
  const register = deps?.register ?? registerVideoThumbs
  const putThumb = deps?.putThumb ?? defaultPutThumb

  let frames: string[]
  try {
    ;({ frames } = await extract(file, THUMB_COUNT))
  } catch {
    // El navegador no pudo decodificar el video: sin carátula, pero la subida ya está hecha.
    return
  }
  if (frames.length === 0) return

  await uploadThumbs(videoId, frames, { getUploadUrls, register, putThumb })
}
