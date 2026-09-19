'use client'

import { useEffect, useState } from 'react'
import { Film, Loader2 } from 'lucide-react'
import { getReciboIdeaPreviewUrl } from '@/lib/actions/recibo'

/**
 * Inline player for Recibo idea cards. Loads a presigned Entregas URL for the
 * edited file; empty state when nothing is uploaded yet.
 */
export function ReciboVideoPreview({
  ideaId,
  hasEdited,
}: {
  ideaId: string
  hasEdited: boolean
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
    getReciboIdeaPreviewUrl(ideaId).then((res) => {
      if (!alive) return
      setLoading(false)
      if (res.url) setUrl(res.url)
      else setError(res.error ?? 'No se pudo cargar el video')
    })
    return () => {
      alive = false
    }
  }, [ideaId, hasEdited])

  if (!hasEdited) {
    return (
      <div
        data-testid="recibo-video-empty"
        className="flex mx-auto aspect-[9/16] w-full max-w-[220px] rounded-md border border-border flex-col items-center justify-center gap-2 border-dashed bg-muted/30 text-muted-foreground"
      >
        <Film className="h-6 w-6 opacity-60" aria-hidden="true" />
        <p className="text-xs font-medium">Sin video editado</p>
        <p className="px-4 text-center text-[10px] opacity-80">
          El video editado aparecerá aquí cuando esté disponible.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        data-testid="recibo-video-loading"
        className="flex mx-auto aspect-[9/16] w-full max-w-[220px] rounded-md border border-border items-center justify-center gap-2 bg-black/80 text-xs text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando video…
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="recibo-video-error"
        className="flex mx-auto aspect-[9/16] w-full max-w-[220px] rounded-md border border-border items-center justify-center bg-muted/30 px-3 text-center text-xs text-amber-200"
      >
        {error}
      </div>
    )
  }

  if (!url) return null

  return (
    <video
      data-testid="recibo-video-player"
      src={url}
      controls
      playsInline
      preload="metadata"
      className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-md border border-border bg-black object-contain"
    >
      Tu navegador no puede reproducir este video.
    </video>
  )
}
