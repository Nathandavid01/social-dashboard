'use client'

/**
 * Dispara el QC IA tras registrar un video editado. Fire-and-forget: NUNCA
 * lanza ni bloquea — si algo falla, simplemente no habrá análisis y el reporte
 * dirá "Análisis no disponible".
 */
import { extractVideoFrames, extractVideoFramesFromUrl } from './video-frames-dom'
import { chunkFrames, detectSceneCuts } from './video-frames'
import { postVideoAnalysisChunks } from './video-analysis-chunks'

/**
 * Mismo origen — NUNCA una URL firmada de R2: ni el bucket privado ni el
 * dominio público r2.dev mandan `access-control-allow-origin`, así que
 * `<video crossOrigin>` + `canvas.toDataURL()` no podrían funcionar contra
 * R2 directo (canvas "tainted" → SecurityError). El proxy hace el mismo
 * chequeo de permiso que `getVideoPreviewUrl` server-side — ver
 * `app/api/video-file/[videoId]/route.ts`.
 */
function videoFileUrl(videoId: string): string {
  return `/api/video-file/${encodeURIComponent(videoId)}`
}

export async function analyzeUploadedVideo(
  videoId: string,
  file: File,
  deps?: {
    extract?: (f: File) => Promise<{ frames: string[]; timestamps: number[]; fingerprints?: { t: number; fingerprint: number[] }[] }>
    post?: typeof fetch
  },
): Promise<void> {
  const extract = deps?.extract ?? extractVideoFrames
  const post = deps?.post ?? fetch
  try {
    const extracted = await extract(file)
    if (extracted.frames.length === 0) return
    const cuts = extracted.fingerprints ? detectSceneCuts(extracted.fingerprints) : []
    await postVideoAnalysisChunks(videoId, chunkFrames(extracted.frames, extracted.timestamps), post, cuts)
  } catch {
    // Silencioso a propósito: el análisis es advisory, la subida ya terminó.
  }
}

/**
 * Igual que `analyzeUploadedVideo` pero para un video YA subido (botón
 * "Analizar con IA" / "Re-analizar" en `QcProgressDots`): saca el video del
 * proxy de mismo origen (`videoFileUrl`, NO una URL firmada de R2 — ver
 * comentario arriba) en vez del disco local, extrae fotogramas a 4fps y
 * postea por tandas — mismo troceado de 64 (`postVideoAnalysisChunks`).
 *
 * NO es fire-and-forget: aquí el usuario está esperando frente al botón, así
 * que devuelve `{ ok }` / `{ error }` para que la UI muestre progreso/errores
 * con toast. Aun así NUNCA lanza — un fallo nunca debe romper el panel.
 */
export async function analyzeExistingVideo(
  videoId: string,
  deps?: {
    videoUrl?: (videoId: string) => string
    extract?: (url: string) => Promise<{ frames: string[]; timestamps: number[]; fingerprints?: { t: number; fingerprint: number[] }[] }>
    post?: typeof fetch
    /** Para que la UI muestre "Extrayendo fotogramas…" → "Analizando…". */
    onProgress?: (phase: 'extracting' | 'analyzing') => void
  },
): Promise<{ ok: true } | { error: string }> {
  const videoUrl = deps?.videoUrl ?? videoFileUrl
  const extract = deps?.extract ?? extractVideoFramesFromUrl
  const post = deps?.post ?? fetch

  try {
    deps?.onProgress?.('extracting')
    const extracted = await extract(videoUrl(videoId))
    if (extracted.frames.length === 0) {
      return { error: 'No se pudieron extraer fotogramas de este video' }
    }

    deps?.onProgress?.('analyzing')
    const cuts = extracted.fingerprints ? detectSceneCuts(extracted.fingerprints) : []
    await postVideoAnalysisChunks(videoId, chunkFrames(extracted.frames, extracted.timestamps), post, cuts)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'El análisis falló' }
  }
}
