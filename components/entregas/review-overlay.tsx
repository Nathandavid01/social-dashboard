'use client'
import {useToast} from '@/lib/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { ReviewQueue, type QueueVideo } from '@/components/review/review-queue'
import { VideoAnalysisReport } from '@/components/video-analysis/video-analysis-report'
import { getEntregaReviewVideos } from '@/lib/actions/entregas-review'
import { getEntregasPreviewUrl } from '@/lib/actions/entregas-r2'
import { decideReview } from '@/lib/actions/pipeline-submit'
import { useAuth } from '@/lib/context/auth-context'

/**
 * What opens when a Revisión card is clicked: the reviewer watches and decides
 * right here. Deliberately NOT the client batch view — that belongs to the
 * other board and answers a different question (the whole client's period,
 * not "is this video good?").
 */
export function ReviewOverlay({
  clientId,
  ideaId,
  clientName,
  onClose,
}: {
  clientId: string
  /** El video de la tarjeta que se abrio. La tarjeta es UN video, asi que el
   *  overlay tiene que enseñar ese y no todos los del cliente. */
  ideaId: string
  clientName: string
  onClose: () => void
}) {
  const router = useRouter()
  const { user, role } = useAuth()
  const [videos, setVideos] = useState<QueueVideo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    setVideos(null)
    getEntregaReviewVideos(clientId).then((res) => {
      if (!alive) return
      if (res.error) setError(res.error)
      // Solo el video de la tarjeta. Se filtra aqui y no en el servidor para no
      // tocar una accion que tambien usa el otro tablero.
      else setVideos((res.videos ?? []).filter((v) => v.id === ideaId))
    }).catch(() => {
      if (alive) setError('No Se Pudieron Cargar Los Videos. Revisa La Conexión Y Vuelve A Intentar.')
    })
    return () => { alive = false }
  }, [clientId, ideaId, retry])

  // Esc closes — a full-screen overlay with no keyboard exit is a trap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const getPreviewUrl = useCallback(
    async (videoFileId: string) => getEntregasPreviewUrl(videoFileId),
    [],
  )

  const {toast} = useToast()
  const onDecide = useCallback(
    async (ideaId: string, decision: 'approve' | 'request_changes', note: string, verification?: {videoFileId:string|null;captionsVerified:boolean;videoVerified:boolean}) => {
      const res = await decideReview({ ideaId, decision, note, ...verification })
      if (res.error) throw new Error(res.error)
      if (res.warning) toast({title: 'Aviso Pendiente', description: res.warning, variant: 'destructive'})
      // Refresh so the board reflects the new column right away.
      router.refresh()
    },
    [router, toast],
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-card px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">Revisión — {clientName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            Mira cada video y decide: aprobar o pedir cambios.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar revisión"
          className="shrink-0 rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mx-auto max-w-2xl p-5">
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <p>{error}</p>
            <button onClick={() => setRetry((n) => n + 1)} className="mt-3 min-h-11 rounded-lg border px-4 font-medium">Volver A Intentar</button>
          </div>
        )}

        {!videos && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando videos…
          </div>
        )}

        {videos && (
          <div className="mb-4">
            <VideoAnalysisReport ideaId={ideaId} />
          </div>
        )}

        {videos && (
          <ReviewQueue
            videos={videos}
            role={role}
            userId={user?.id ?? null}
            getPreviewUrl={getPreviewUrl}
            onDecide={onDecide}
          />
        )}
      </div>
    </div>
  )
}
