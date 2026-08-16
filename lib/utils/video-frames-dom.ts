'use client'

/**
 * Captura real de frames con <video> + canvas. Dos entradas, un mismo motor
 * (`extractFramesFromVideoElement`):
 *  - `extractVideoFrames(file)`: File local ya en memoria (editor, al subir)
 *    — nunca se descarga nada de R2.
 *  - `extractVideoFramesFromUrl(url)`: URL firmada de preview (video YA
 *    subido, botón "Analizar con IA" / "Re-analizar") — sí viaja por red,
 *    de ahí el giveUpMs más generoso.
 * Ambas lanzan si el codec no decodifica o el tiempo se agota; el caller las
 * trata como "sin análisis". `VideoSceneStrip` (tira de 5 escenas) usa el
 * mismo motor con su propio <video> del DOM y muestreo por conteo fijo en
 * vez de fps — ver `video-scene-strip.tsx`.
 */
import {
  frameTimestamps, scaleDimensions, FRAME_FPS, FRAME_HARD_MAX, FRAME_JPEG_QUALITY, FRAME_MAX_SIDE,
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

/**
 * readyState >= 1 (HAVE_METADATA) significa que 'loadedmetadata' ya disparó
 * ANTES de que este código conectara el listener — sin este chequeo, un
 * <video> cuyo `src` se asignó por JSX (no en el mismo tick que el listener,
 * como pasa en VideoSceneStrip) puede dejar la promesa esperando un evento
 * que ya pasó.
 */
function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('el browser no pudo decodificar el video'))
  })
}

export interface ExtractFramesOptions {
  /** Deriva los timestamps a capturar a partir de la duración ya conocida. */
  timestampsFor: (durationSeconds: number) => number[]
  maxSide?: number
  /** Un <video> servido por red (URL firmada) puede colgarse en metadata o
   *  seek sin disparar ningún evento — a los `giveUpMs` se rinde. */
  giveUpMs?: number
  /** Chequeado antes de cada seek; permite abortar temprano (p.ej. el
   *  componente que llama se desmontó) sin gastar más seeks. */
  shouldContinue?: () => boolean
  /** Se invoca tras cada seek exitoso, con las dimensiones ya escaladas.
   *  Si devuelve un string (data URI), se acumula en `frames`; si no
   *  devuelve nada (p.ej. quien pinta directo en su propio canvas de UI),
   *  `frames` queda vacío — el caller usa `timestamps` para lo demás. */
  onFrame?: (args: { video: HTMLVideoElement; width: number; height: number; t: number; index: number }) => string | void
}

const DEFAULT_GIVE_UP_MS = 15_000

/**
 * Motor compartido: espera metadata, valida duración degenerada
 * (Infinity/0 — webm/MediaRecorder sin duración fija), escala dimensiones, y
 * recorre `timestampsFor(duration)` haciendo seek+captura en cada uno.
 * Nunca deja timestamps a medio pintar colgado para siempre: `giveUpMs`
 * lanza si metadata o un seek nunca resuelven.
 */
export async function extractFramesFromVideoElement(
  video: HTMLVideoElement,
  opts: ExtractFramesOptions,
): Promise<{ frames: string[]; timestamps: number[] }> {
  const {
    timestampsFor, maxSide = FRAME_MAX_SIDE, giveUpMs = DEFAULT_GIVE_UP_MS,
    shouldContinue = () => true, onFrame,
  } = opts

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const giveUp = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('tiempo de espera agotado extrayendo fotogramas')),
      giveUpMs,
    )
  })

  const work = (async () => {
    await waitForMetadata(video)

    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) return { frames: [], timestamps: [] }

    const { width, height } = scaleDimensions(video.videoWidth, video.videoHeight, maxSide)
    if (!width || !height) return { frames: [], timestamps: [] }

    const timestamps = timestampsFor(duration)
    const frames: string[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (!shouldContinue()) break
      await seekTo(video, timestamps[i])
      if (!shouldContinue()) break
      const result = onFrame?.({ video, width, height, t: timestamps[i], index: i })
      if (typeof result === 'string') frames.push(result)
    }
    return { frames, timestamps }
  })()

  try {
    return await Promise.race([work, giveUp])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

function captureDataUrlFrames(video: HTMLVideoElement): Promise<{ frames: string[]; timestamps: number[] }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas no disponible')

  return extractFramesFromVideoElement(video, {
    // Muestrea hasta FRAME_HARD_MAX (60s a 4fps): el presupuesto de bytes de
    // cable se aplica por CHUNK, no aquí — ver chunkFrames() en
    // video-frames.ts y el troceado en video-analysis-chunks.ts.
    timestampsFor: (duration) => frameTimestamps(duration, FRAME_FPS, FRAME_HARD_MAX),
    onFrame: ({ video, width, height }) => {
      canvas.width = width
      canvas.height = height
      ctx.drawImage(video, 0, 0, width, height)
      return canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY)
    },
  })
}

/** Extrae frames de un `File` local (el editor, en el momento de subir). */
export async function extractVideoFrames(file: File): Promise<{ frames: string[]; timestamps: number[] }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    return await captureDataUrlFrames(video)
  } finally {
    URL.revokeObjectURL(url)
    video.src = ''
  }
}

/**
 * Extrae frames desde una URL firmada de preview (video YA subido a R2) —
 * mismo motor y contrato de retorno que `extractVideoFrames`, para el botón
 * "Analizar con IA" / "Re-analizar" (`analyzeExistingVideo`).
 */
export async function extractVideoFramesFromUrl(url: string): Promise<{ frames: string[]; timestamps: number[] }> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.src = url
  try {
    return await captureDataUrlFrames(video)
  } finally {
    video.src = ''
  }
}
