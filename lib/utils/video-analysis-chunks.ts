'use client'

/**
 * POST secuencial de chunks de frames a /api/video-analysis, compartido entre
 * analyzeUploadedVideo (video-analysis-client.ts) y processUploadedVideo
 * (video-postupload-client.ts) para no duplicar el troceado dos veces.
 *
 * Fire-and-forget POR CHUNK: si uno falla, los demás igual se postean — nunca
 * lanza. Cada chunk se recorta al presupuesto de bytes de cable como red de
 * seguridad (en la práctica FRAME_CHUNK_SIZE ya cabe, ~3.2MB medido).
 */
import { capFramesAndTimestampsToBudget } from './video-frames'

export async function postVideoAnalysisChunks(
  videoId: string,
  chunks: { frames: string[]; timestamps: number[] }[],
  post: typeof fetch,
): Promise<void> {
  const total = chunks.length
  for (let index = 0; index < total; index++) {
    const { frames, timestamps } = capFramesAndTimestampsToBudget(chunks[index].frames, chunks[index].timestamps)
    try {
      await post('/api/video-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, frames, timestamps, chunk: { index, total } }),
      })
    } catch {
      // Silencioso a propósito: un chunk perdido no debe tumbar los demás.
    }
  }
}
