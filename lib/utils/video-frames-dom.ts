'use client'

/**
 * Captura real de frames con <video> + canvas, en el browser del editor
 * (el File local ya está en memoria — no se descarga nada de R2).
 * Lanza si el codec no decodifica; el caller lo trata como "sin análisis".
 */
import {
  frameTimestamps, scaleDimensions, FRAME_FPS, FRAME_HARD_MAX, FRAME_JPEG_QUALITY,
} from './video-frames'

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeek = () => { cleanup(); resolve() }
    const onErr = () => { cleanup(); reject(new Error('seek falló')) }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeek)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener('seeked', onSeek)
    video.addEventListener('error', onErr)
    video.currentTime = t
  })
}

export async function extractVideoFrames(file: File): Promise<{ frames: string[]; timestamps: number[] }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('el browser no pudo decodificar el video'))
      video.src = url
    })
    const { width, height } = scaleDimensions(video.videoWidth, video.videoHeight)
    if (!width || !height) throw new Error('video sin dimensiones')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas no disponible')

    const frames: string[] = []
    // Muestrea hasta FRAME_HARD_MAX (60s a 4fps): el presupuesto de bytes de
    // cable se aplica por CHUNK, no aquí — ver chunkFrames() en
    // video-frames.ts y el troceado en video-analysis-client.ts.
    const timestamps = frameTimestamps(video.duration, FRAME_FPS, FRAME_HARD_MAX)
    for (const t of timestamps) {
      await seekTo(video, t)
      ctx.drawImage(video, 0, 0, width, height)
      frames.push(canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY))
    }
    return { frames, timestamps }
  } finally {
    URL.revokeObjectURL(url)
    video.src = ''
  }
}
