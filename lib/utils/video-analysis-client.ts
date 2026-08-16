'use client'

/**
 * Dispara el QC IA tras registrar un video editado. Fire-and-forget: NUNCA
 * lanza ni bloquea — si algo falla, simplemente no habrá análisis y el reporte
 * dirá "Análisis no disponible".
 */
import { extractVideoFrames } from './video-frames-dom'

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
    await post('/api/video-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, frames, timestamps }),
    })
  } catch {
    // Silencioso a propósito: el análisis es advisory, la subida ya terminó.
  }
}
