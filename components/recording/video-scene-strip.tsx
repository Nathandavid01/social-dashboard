'use client'

/**
 * Tira de 5 escenas del video editado, para no tener que darle play para ver
 * de qué se trata. Dos caminos:
 *  1. Guardado al subir (thumb_keys en R2) → 5 <img> directas.
 *  2. Fallback al vuelo (videos viejos, sin thumb_keys) → <video> oculto +
 *     canvas, pintando 5 frames equiespaciados con el mismo helper puro del
 *     QC IA (frameTimestamps/scaleDimensions).
 * Nunca rompe nada: cualquier fallo → no renderiza (return null).
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getVideoThumbViewUrls } from '@/lib/actions/video-thumbs'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'
import { frameTimestamps, scaleDimensions } from '@/lib/utils/video-frames'
import { THUMB_COUNT } from '@/lib/utils/video-thumbs'

type State =
  | { kind: 'loading' }
  | { kind: 'stored'; urls: string[] }
  | { kind: 'live'; previewUrl: string }
  | { kind: 'none' }

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

export function VideoSceneStrip({ videoId, onOpen }: { videoId: string; onOpen?: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([])

  // Camino 1: ¿ya hay thumbnails guardados? Si no, camino 2: preview firmado
  // para pintar al vuelo. Cualquier error en cualquiera de los dos → 'none'.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const stored = await getVideoThumbViewUrls(videoId)
        if (!alive) return
        if (stored.urls.length > 0) {
          setState({ kind: 'stored', urls: stored.urls })
          return
        }
      } catch { /* cae al fallback */ }

      try {
        const preview = await getVideoPreviewUrl(videoId)
        if (!alive) return
        if (preview.url) {
          setState({ kind: 'live', previewUrl: preview.url })
          return
        }
      } catch { /* nada más que intentar */ }

      if (alive) setState({ kind: 'none' })
    })()
    return () => { alive = false }
  }, [videoId])

  // Camino 2 (continuación): con el <video> oculto ya montado (src=previewUrl),
  // busca los timestamps y pinta cada uno en su <canvas>. No es testeable en
  // jsdom (canvas 2D + seek de <video> no están implementados ahí) — el caso
  // "duración degenerada → sin timestamps" SÍ está cubierto vía el helper puro
  // (frameTimestamps(Infinity/0, ...) === [] en video-frames.test.ts).
  useEffect(() => {
    if (state.kind !== 'live') return
    const video = videoRef.current
    if (!video) return
    let alive = true
    let settled = false

    // Un video "vivo" pero mudo (metadata que nunca llega, seek que nunca
    // dispara 'seeked') no debe dejar la tira colgada para siempre — a los
    // ~10s se rinde y cae a 'none'. La promesa de fondo puede seguir viva,
    // pero `alive`/`settled` la vuelven un no-op inofensivo.
    const giveUp = window.setTimeout(() => {
      if (!settled && alive) { settled = true; setState({ kind: 'none' }) }
    }, 10_000)

    function waitForMetadata(): Promise<void> {
      // readyState >= 1 (HAVE_METADATA) significa que 'loadedmetadata' ya
      // disparó ANTES de que este efecto conectara el listener — sin este
      // chequeo, esa carrera deja la promesa esperando un evento que ya pasó.
      if (video!.readyState >= 1) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        video!.onloadedmetadata = () => resolve()
        video!.onerror = () => reject(new Error('el browser no pudo decodificar el video'))
      })
    }

    ;(async () => {
      try {
        await waitForMetadata()
        if (!alive || settled) return

        const duration = video.duration
        if (!Number.isFinite(duration) || duration <= 0) {
          // webm/MediaRecorder sin duración fija (Infinity) o metadata corrupta.
          settled = true
          setState({ kind: 'none' })
          return
        }

        const { width, height } = scaleDimensions(video.videoWidth, video.videoHeight, 320)
        if (!width || !height) { settled = true; setState({ kind: 'none' }); return }

        const times = frameTimestamps(duration, THUMB_COUNT)
        if (times.length === 0) { settled = true; setState({ kind: 'none' }); return }

        for (let i = 0; i < times.length; i++) {
          if (!alive || settled) return
          await seekTo(video, times[i])
          if (!alive || settled) return
          const canvas = canvasRefs.current[i]
          const ctx = canvas?.getContext('2d')
          if (canvas && ctx) {
            canvas.width = width
            canvas.height = height
            ctx.drawImage(video, 0, 0, width, height)
          }
        }
        settled = true
      } catch {
        if (alive && !settled) { settled = true; setState({ kind: 'none' }) }
      } finally {
        window.clearTimeout(giveUp)
      }
    })()

    return () => { alive = false; window.clearTimeout(giveUp) }
  }, [state])

  if (state.kind === 'loading') {
    return (
      <div className="flex gap-1.5" data-testid="scene-strip-skeleton">
        {Array.from({ length: THUMB_COUNT }).map((_, i) => (
          <div key={i} className="aspect-video w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (state.kind === 'none') return null

  if (state.kind === 'stored') {
    return (
      <div className="flex gap-1.5 animate-in fade-in duration-300">
        {state.urls.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={`Escena ${i + 1}`}
            onClick={onOpen}
            className={cn(
              'aspect-video w-full rounded border object-cover',
              onOpen && 'cursor-pointer transition-opacity hover:opacity-80',
            )}
          />
        ))}
      </div>
    )
  }

  // state.kind === 'live'
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} src={state.previewUrl} muted playsInline className="hidden" />
      <div className="flex gap-1.5 animate-in fade-in duration-300">
        {Array.from({ length: THUMB_COUNT }).map((_, i) => (
          <canvas
            key={i}
            ref={(el) => { canvasRefs.current[i] = el }}
            onClick={onOpen}
            className={cn(
              'aspect-video w-full rounded border bg-muted',
              onOpen && 'cursor-pointer transition-opacity hover:opacity-80',
            )}
          />
        ))}
      </div>
    </>
  )
}
