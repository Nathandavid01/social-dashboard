'use client'

import { useEffect, useState } from 'react'
import { Film, Loader2 } from 'lucide-react'
import { getReciboIdeaPreviewUrl } from '@/lib/actions/recibo'
import { cn } from '@/lib/utils'

/**
 * Inline 9:16 player for Recibo idea cards (house lock /aprobacion match).
 */
export function ReciboVideoPreview({
  ideaId,
  hasEdited,
  expectedVideoId,
  className,
}: {
  ideaId: string
  hasEdited: boolean
  expectedVideoId?: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hasEdited) {
      setUrl(null)
      setError(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setUrl(null)
    setError(null)
    const request = expectedVideoId
      ? getReciboIdeaPreviewUrl(ideaId, expectedVideoId)
      : getReciboIdeaPreviewUrl(ideaId)
    request.then((res) => {
      if (!alive) return
      setLoading(false)
      if (res.url) setUrl(res.url)
      else setError(res.error ?? 'No se pudo cargar el video')
    })
    return () => {
      alive = false
    }
  }, [ideaId, hasEdited, expectedVideoId])

  const frame = cn(
    'aspect-[9/16] w-full overflow-hidden rounded-[1.25rem] bg-black',
    className,
  )

  if (!hasEdited) {
    return (
      <div
        data-testid="recibo-video-empty"
        className={cn(frame, 'flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/40 text-muted-foreground')}
      >
        <Film className="h-7 w-7 opacity-50" aria-hidden="true" />
        <p className="text-xs font-medium">Sin video editado</p>
        <p className="px-5 text-center text-[10px] leading-snug opacity-80">
          El corte aparecerá aquí cuando esté en Entregas.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        data-testid="recibo-video-loading"
        className={cn(frame, 'flex items-center justify-center gap-2 text-xs text-muted-foreground')}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando…
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="recibo-video-error"
        className={cn(frame, 'flex items-center justify-center bg-muted/40 px-4 text-center text-xs text-amber-200')}
      >
        {error}
      </div>
    )
  }

  if (!url) return null

  return (
    <div className={cn(frame, 'ring-1 ring-white/10 shadow-lg shadow-black/40')}>
      <video
        data-testid="recibo-video-player"
        src={url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      >
        Tu navegador no puede reproducir este video.
      </video>
    </div>
  )
}
