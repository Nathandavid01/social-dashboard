'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Film } from 'lucide-react'
import { getPipelineVideoThumbViewUrls } from '@/lib/actions/video-thumbs'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'
import { extractFramesFromVideoElement } from '@/lib/utils/video-frames-dom'
import { evenTimestamps } from '@/lib/utils/video-frames'

type CoverState =
  | { kind: 'loading' }
  | { kind: 'image'; url: string }
  | { kind: 'live'; previewUrl: string }
  | { kind: 'none' }

/**
 * Una sola carátula estática que llena la tarjeta. Dos caminos:
 *  1. thumb_keys guardados al subir → <img> directa (lo barato).
 *  2. Fallback al vuelo (videos viejos sin thumbs): <video> oculto + canvas,
 *     UN solo frame del medio — mismo motor que la tira de escenas. "Tiene
 *     que tener una foto, no puede ser negro."
 * Cualquier fallo cae al placeholder sin romper la tarjeta.
 */
export function VideoCover({ videoId, title }: { videoId: string; title: string }) {
  const [state, setState] = useState<CoverState>({ kind: 'loading' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const label = `Carátula de ${title}`

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const stored = await getPipelineVideoThumbViewUrls(videoId)
        if (!alive) return
        if (stored.urls[0]) {
          setState({ kind: 'image', url: stored.urls[0] })
          return
        }
      } catch {
        // La carátula es informativa y nunca debe romper la tarjeta.
      }

      try {
        const preview = await getVideoPreviewUrl(videoId)
        if (!alive) return
        if (preview.url) {
          setState({ kind: 'live', previewUrl: preview.url })
          return
        }
      } catch {
        /* nada más que intentar */
      }

      if (alive) setState({ kind: 'none' })
    })()

    return () => { alive = false }
  }, [videoId])

  // Camino 2: pinta un frame del medio del video en el canvas. No testeable en
  // jsdom (sin canvas 2D ni seek real) — el motor está cubierto en
  // lib/utils/video-frames-dom.test.ts.
  useEffect(() => {
    if (state.kind !== 'live') return
    const video = videoRef.current
    if (!video) return
    let alive = true

    extractFramesFromVideoElement(video, {
      timestampsFor: (duration) => evenTimestamps(duration, 3).slice(1, 2),
      maxSide: 480,
      metadataTimeoutMs: 10_000,
      seekTimeoutMs: 10_000,
      shouldContinue: () => alive,
      onFrame: ({ video, width, height }) => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
          canvas.width = width
          canvas.height = height
          ctx.drawImage(video, 0, 0, width, height)
        }
      },
    })
      .then((res) => {
        if (alive && res.timestamps.length === 0) setState({ kind: 'none' })
      })
      .catch(() => {
        if (alive) setState({ kind: 'none' })
      })

    return () => { alive = false }
  }, [state])

  if (state.kind === 'image') {
    return <Image src={state.url} alt={label} fill unoptimized sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
  }

  if (state.kind === 'live') {
    return (
      <div className="relative h-full w-full" aria-label={label}>
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
        <video
          ref={videoRef}
          src={state.previewUrl}
          preload="metadata"
          muted
          playsInline
          crossOrigin="anonymous"
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      </div>
    )
  }

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-800 to-black" aria-label={state.kind === 'loading' ? 'Cargando carátula' : 'Carátula no disponible'}>
      <Film className={`h-6 w-6 text-slate-600 ${state.kind === 'loading' ? 'animate-pulse' : ''}`} />
    </div>
  )
}
