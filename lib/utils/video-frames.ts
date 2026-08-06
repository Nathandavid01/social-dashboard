/**
 * Captura de frames de un video en el NAVEGADOR (canvas — sin ffmpeg).
 * Enfoque A del spec: los frames viajan al server action como base64.
 * Cualquier fallo devuelve [] — la subida del video nunca depende de esto.
 */

export const DEFAULT_FRAME_COUNT = 10
/** Lado largo máximo del JPEG exportado. */
const MAX_DIM = 720
const JPEG_QUALITY = 0.8
const CAPTURE_TIMEOUT_MS = 30_000

/** Puntos de muestreo equidistantes, evitando el frame 0 y el último 0.5s. */
export function frameTimestamps(durationSec: number, count = DEFAULT_FRAME_COUNT): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || count < 1) return []
  const end = Math.max(durationSec - 0.5, durationSec * 0.9)
  const usable = durationSec
  const n = Math.min(count, Math.max(1, Math.floor(durationSec)))
  const step = usable / (n + 1)
  return Array.from({ length: n }, (_, i) => (i + 1) * step)
}

export async function captureVideoFrames(
  file: File,
  count = DEFAULT_FRAME_COUNT,
): Promise<Array<{ b64: string; second: number }>> {
  if (typeof document === 'undefined') return []
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  const cleanup = () => {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('frame capture timeout')), CAPTURE_TIMEOUT_MS),
  )

  try {
    return await Promise.race([timeout, (async () => {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('video load error'))
      })
      const timestamps = frameTimestamps(video.duration, count)
      if (!timestamps.length) return []

      const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx || !canvas.width || !canvas.height) return []

      const frames: Array<{ b64: string; second: number }> = []
      for (const second of timestamps) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve()
          video.onerror = () => reject(new Error('seek error'))
          video.currentTime = second
        })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        const b64 = dataUrl.split(',')[1]
        if (b64) frames.push({ b64, second: Math.round(second) })
      }
      return frames
    })()])
  } catch {
    return []
  } finally {
    cleanup()
  }
}
