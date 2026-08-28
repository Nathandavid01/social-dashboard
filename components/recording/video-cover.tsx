'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Film } from 'lucide-react'
import { getVideoThumbViewUrls } from '@/lib/actions/video-thumbs'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'

type CoverState =
  | { kind: 'loading' }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'none' }

/**
 * Una sola carátula que siempre llena la tarjeta. Prefiere el JPG ya generado;
 * para videos viejos usa el propio archivo, evitando depender de canvas/CORS.
 */
export function VideoCover({ videoId, title }: { videoId: string; title: string }) {
  const [state, setState] = useState<CoverState>({ kind: 'loading' })
  const label = `Carátula de ${title}`

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const stored = await getVideoThumbViewUrls(videoId)
        if (!alive) return
        if (stored.urls[0]) {
          setState({ kind: 'image', url: stored.urls[0] })
          return
        }
      } catch { /* usa el video como fallback */ }

      try {
        const preview = await getVideoPreviewUrl(videoId)
        if (!alive) return
        setState(preview.url ? { kind: 'video', url: preview.url } : { kind: 'none' })
      } catch {
        if (alive) setState({ kind: 'none' })
      }
    })()

    return () => { alive = false }
  }, [videoId])

  if (state.kind === 'image') {
    return <Image src={state.url} alt={label} fill unoptimized sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
  }

  if (state.kind === 'video') {
    return (
      // La tarjeta solo necesita el fotograma; reproducir sigue en el botón Ver.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={state.url}
        aria-label={label}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = Math.min(0.1, video.duration / 10)
          }
        }}
      />
    )
  }

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-800 to-black" aria-label={state.kind === 'loading' ? 'Cargando carátula' : 'Carátula no disponible'}>
      <Film className={`h-6 w-6 text-slate-600 ${state.kind === 'loading' ? 'animate-pulse' : ''}`} />
    </div>
  )
}
