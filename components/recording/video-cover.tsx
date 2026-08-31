'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Film } from 'lucide-react'
import { getPipelineVideoThumbViewUrls } from '@/lib/actions/video-thumbs'

type CoverState =
  | { kind: 'loading' }
  | { kind: 'image'; url: string }
  | { kind: 'none' }

/**
 * Una sola carátula estática que llena la tarjeta. Nunca carga ni reproduce el
 * archivo de video desde Pipeline.
 */
export function VideoCover({ videoId, title }: { videoId: string; title: string }) {
  const [state, setState] = useState<CoverState>({ kind: 'loading' })
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
      if (alive) setState({ kind: 'none' })
    })()

    return () => { alive = false }
  }, [videoId])

  if (state.kind === 'image') {
    return <Image src={state.url} alt={label} fill unoptimized sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
  }

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-800 to-black" aria-label={state.kind === 'loading' ? 'Cargando carátula' : 'Carátula no disponible'}>
      <Film className={`h-6 w-6 text-slate-600 ${state.kind === 'loading' ? 'animate-pulse' : ''}`} />
    </div>
  )
}
