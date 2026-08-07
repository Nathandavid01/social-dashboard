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
/** Presupuesto de payload del cliente (suma de b64.length) antes de enviar al server action. */
export const MAX_TOTAL_B64_CHARS = 2_500_000

/**
 * Recorta `frames` para que la suma de `b64.length` quepa en `maxTotalChars`,
 * descartando frames alternos (manteniendo el orden cronológico) hasta caber.
 * Si un solo frame ya excede el presupuesto, devuelve [].
 */
export function fitFramesToBudget<T extends { b64: string }>(
  frames: T[],
  maxTotalChars: number,
): T[] {
  let current = frames
  while (current.length > 0) {
    const total = current.reduce((sum, f) => sum + f.b64.length, 0)
    if (total <= maxTotalChars) return current
    if (current.length === 1) return []
    current = current.filter((_, i) => i % 2 === 0)
  }
  return current
}

/** Distributes n frame timestamps equidistantly across duration.
 * Places frames at the inner points of n+1 equal segments: positions 1*step through n*step,
 * where step = duration/(n+1). This leaves equal gaps at start and end.
 */
export function frameTimestamps(durationSec: number, count = DEFAULT_FRAME_COUNT): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || count < 1) return []
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

  try {
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
        return fitFramesToBudget(frames, MAX_TOTAL_B64_CHARS)
      })()])
    } finally {
      cleanup()
    }
  } catch {
    return []
  }
}
