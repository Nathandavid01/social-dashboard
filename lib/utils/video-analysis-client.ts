'use client'

/**
 * Dispara el QC IA tras registrar un video editado. Fire-and-forget: NUNCA
 * lanza ni bloquea — si algo falla, simplemente no habrá análisis y el reporte
 * dirá "Análisis no disponible".
 */
import { extractVideoFrames, extractVideoFramesFromUrl } from './video-frames-dom'
import { chunkFrames } from './video-frames'
import { postVideoAnalysisChunks } from './video-analysis-chunks'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'

export async function analyzeUploadedVideo(
  videoId: string,
  file: File,
  deps?: {
    extract?: (f: File) => Promise<{ frames: string[]; timestamps: number[] }>
    post?: typeof fetch
  },
): Promise<void> {
  const extract = deps?.extract ?? extractVideoFrames
  const post = deps?.post ?? fetch
  try {
    const { frames, timestamps } = await extract(file)
    if (frames.length === 0) return
    await postVideoAnalysisChunks(videoId, chunkFrames(frames, timestamps), post)
  } catch {
    // Silencioso a propósito: el análisis es advisory, la subida ya terminó.
  }
}

/**
 * Igual que `analyzeUploadedVideo` pero para un video YA subido (botón
 * "Analizar con IA" / "Re-analizar" en `QcProgressDots`): saca el File de R2
 * (URL firmada de preview) en vez del disco local, extrae fotogramas a 4fps y
 * postea por tandas — mismo troceado de 64 (`postVideoAnalysisChunks`).
 *
 * NO es fire-and-forget: aquí el usuario está esperando frente al botón, así
 * que devuelve `{ ok }` / `{ error }` para que la UI muestre progreso/errores
 * con toast. Aun así NUNCA lanza — un fallo nunca debe romper el panel.
 */
export async function analyzeExistingVideo(
  videoId: string,
  deps?: {
    getPreviewUrl?: (videoId: string) => Promise<{ url?: string; error?: string }>
    extract?: (url: string) => Promise<{ frames: string[]; timestamps: number[] }>
    post?: typeof fetch
    /** Para que la UI muestre "Extrayendo fotogramas…" → "Analizando…". */
    onProgress?: (phase: 'extracting' | 'analyzing') => void
  },
): Promise<{ ok: true } | { error: string }> {
  const getPreviewUrl = deps?.getPreviewUrl ?? getVideoPreviewUrl
  const extract = deps?.extract ?? extractVideoFramesFromUrl
  const post = deps?.post ?? fetch

  try {
    const preview = await getPreviewUrl(videoId)
    if (preview.error || !preview.url) {
      return { error: preview.error ?? 'No se pudo cargar el video para analizarlo' }
    }

    deps?.onProgress?.('extracting')
    const { frames, timestamps } = await extract(preview.url)
    if (frames.length === 0) {
      return { error: 'No se pudieron extraer fotogramas de este video' }
    }

    deps?.onProgress?.('analyzing')
    await postVideoAnalysisChunks(videoId, chunkFrames(frames, timestamps), post)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'El análisis falló' }
  }
}
