'use client'

/**
 * Tira de 5 escenas del video editado, para no tener que darle play para ver
 * de qué se trata. Dos caminos:
 *  1. Guardado al subir (thumb_keys en R2) → 5 <img> directas.
 *  2. Fallback al vuelo (videos viejos, sin thumb_keys) → <video> oculto +
 *     canvas, pintando 5 frames equiespaciados con el mismo helper puro que
 *     usa el QC IA para la matemática de espaciado (evenTimestamps/scaleDimensions) —
 *     NO frameTimestamps(), que muestrea por fps y no por cantidad fija.
 * Nunca rompe nada: cualquier fallo → no renderiza (return null).
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { getVideoThumbViewUrls } from '@/lib/actions/video-thumbs'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'
import { evenTimestamps } from '@/lib/utils/video-frames'
import { extractFramesFromVideoElement } from '@/lib/utils/video-frames-dom'
import { THUMB_COUNT } from '@/lib/utils/video-thumbs'

type State =
  | { kind: 'loading' }
  | { kind: 'stored'; urls: string[] }
  | { kind: 'live'; previewUrl: string }
  | { kind: 'none' }

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
  // usa el motor compartido (video-frames-dom.ts) para buscar 5 timestamps
  // equiespaciados y pintar cada uno en su <canvas> — mismas guardas de
  // duración degenerada/readyState/timeout que extractVideoFrames(FromUrl).
  // No es testeable en jsdom más allá de esas guardas (canvas 2D + seek real
  // de <video> no están implementados ahí) — cubierto en
  // lib/utils/video-frames-dom.test.ts.
  useEffect(() => {
    if (state.kind !== 'live') return
    const video = videoRef.current
    if (!video) return
    let alive = true

    extractFramesFromVideoElement(video, {
      timestampsFor: (duration) => evenTimestamps(duration, THUMB_COUNT),
      maxSide: 320,
      // Tira de 5 escenas: rendirse rápido sigue siendo la prioridad (no son
      // 240 fotogramas) — mismo presupuesto de 10s que tenía antes, pero
      // ahora por operación (metadata Y cada uno de los 5 seeks) en vez de
      // uno global para las 6 esperas juntas.
      metadataTimeoutMs: 10_000,
      seekTimeoutMs: 10_000,
      shouldContinue: () => alive,
      onFrame: ({ video, width, height, index }) => {
        const canvas = canvasRefs.current[index]
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
          canvas.width = width
          canvas.height = height
          ctx.drawImage(video, 0, 0, width, height)
        }
      },
    })
      .then((res) => {
        // Duración degenerada o sin dimensiones → el motor no generó
        // timestamps: nada que pintar, cae a 'none' en vez de dejar 5
        // canvases vacíos para siempre.
        if (alive && res.timestamps.length === 0) setState({ kind: 'none' })
      })
      .catch(() => {
        // Metadata/seek que nunca resuelven (timeout) o codec no decodifica.
        if (alive) setState({ kind: 'none' })
      })

    return () => { alive = false }
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
