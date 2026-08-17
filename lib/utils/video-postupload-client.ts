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
import { pickThumbFrames, THUMB_COUNT } from './video-thumbs'
import { getThumbUploadUrls, registerVideoThumbs } from '@/lib/actions/video-thumbs'

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri)
  return res.blob()
}

export interface ProcessUploadedVideoDeps {
  extract?: (f: File) => Promise<{ frames: string[]; timestamps: number[]; fingerprints?: { t: number; fingerprint: number[] }[] }>
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
  const putThumb =
    deps?.putThumb ??
    (async (url: string, dataUri: string) => {
      const blob = await dataUriToBlob(dataUri)
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
      // R2 puede rechazar sin lanzar (403 de presign vencido, 5xx) — un PUT
      // "exitoso" que en realidad no subió nada dejaría thumb_keys apuntando
      // a objetos que no existen. Lanzar aquí hace que uploadThumbs() no
      // registre ninguna key de este lote (todo o nada).
      if (!res.ok) throw new Error(`R2 ${res.status} subiendo thumbnail`)
    })

  let frames: string[]
  let timestamps: number[]
  let fingerprints: { t: number; fingerprint: number[] }[] | undefined
  try {
    ;({ frames, timestamps, fingerprints } = await extract(file))
  } catch {
    // Silencioso: el navegador no pudo decodificar el video — ni análisis ni thumbs.
    return
  }
  if (frames.length === 0) return

  const cuts = fingerprints ? detectSceneCuts(fingerprints) : []

  // Ambos son independientes: uno puede fallar sin tumbar al otro.
  await Promise.allSettled([
    analyze(videoId, frames, timestamps, post, cuts),
    uploadThumbs(videoId, frames, { getUploadUrls, register, putThumb }),
  ])
}
