'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { InternalReviewPanel, type ReviewVideo } from './internal-review-panel'
import { isAwaitingReview } from '@/lib/utils/internal-review'
import { Button } from '@/components/ui/button'
import type { IdeaApprovalStatus, UserRole } from '@/lib/supabase/types'

/**
 * The reviewer's queue for one client's batch: ONE video at a time, decided on
 * the spot. The board groups by client, but reviewing is per video — a single
 * Revisión card can hide up to 10 separate decisions.
 *
 * The playback URL is fetched per video as it comes on screen, never all at
 * once: getR2PreviewUrl signs for 1 hour, so URLs minted up front would be dead
 * by the time a reviewer works down a long batch.
 */

export interface QueueVideo {
  /** content_ideas.id — what a decision is recorded against. */
  id: string
  /** content_idea_videos.id of the edited file — what gets signed for playback. */
  videoFileId: string | null
  title: string
  clientName: string
  approval_status: IdeaApprovalStatus
  submitted_by?: string | null
  submittedByName?: string | null
  reviewNote?: string | null
}

export function ReviewQueue({
  videos,
  role,
  userId,
  getPreviewUrl,
  onDecide,
}: {
  videos: QueueVideo[]
  role: UserRole | null | undefined
  userId: string | null | undefined
  getPreviewUrl: (videoFileId: string) => Promise<{ url?: string; error?: string }>
  onDecide: (ideaId: string, decision: 'approve' | 'request_changes', note: string) => Promise<void>
}) {
  // Local decisions layer over the incoming props so the queue advances without
  // waiting for the parent to refetch the board.
  const [decided, setDecided] = useState<Record<string, IdeaApprovalStatus>>({})
  const [index, setIndex] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const statusOf = useCallback(
    (v: QueueVideo): IdeaApprovalStatus => decided[v.id] ?? v.approval_status,
    [decided],
  )

  const pendingVideos = useMemo(
    () => videos.filter((v) => isAwaitingReview({ approval_status: statusOf(v) })),
    [videos, statusOf],
  )
  const reviewedCount = videos.length - pendingVideos.length
  const current = pendingVideos[Math.min(index, Math.max(0, pendingVideos.length - 1))] ?? null

  // Sign the current video only. Guarded so a slow response for a video the
  // reviewer already moved past can't overwrite the one now on screen.
  useEffect(() => {
    if (!current?.videoFileId) {
      setUrl(null)
      setUrlError(current ? 'Este video no tiene archivo subido' : null)
      return
    }
    let alive = true
    setUrl(null)
    setUrlError(null)
    getPreviewUrl(current.videoFileId).then((res) => {
      if (!alive) return
      if (res.url) setUrl(res.url)
      else setUrlError(res.error ?? 'No se pudo cargar el video')
    })
    return () => { alive = false }
  }, [current?.videoFileId, current, getPreviewUrl])

  async function decide(decision: 'approve' | 'request_changes', note: string) {
    if (!current || pending) return
    setPending(true)
    try {
      await onDecide(current.id, decision, note)
      setDecided((d) => ({
        ...d,
        [current.id]: decision === 'approve' ? 'approved' : 'revision_needed',
      }))
      setIndex(0) // next pending video slides into place
    } finally {
      setPending(false)
    }
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="text-sm font-medium">No queda nada por revisar</p>
        <p className="text-xs text-muted-foreground">
          {videos.length} video{videos.length === 1 ? '' : 's'} revisado{videos.length === 1 ? '' : 's'}.
        </p>
      </div>
    )
  }

  const panelVideo: ReviewVideo = {
    id: current.id,
    title: current.title,
    clientName: current.clientName,
    editedUrl: url,
    approval_status: statusOf(current),
    submitted_by: current.submitted_by,
    submittedByName: current.submittedByName,
    reviewNote: current.reviewNote,
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">
          {reviewedCount} de {videos.length} revisados
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Video anterior"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Siguiente video"
            disabled={index >= pendingVideos.length - 1}
            onClick={() => setIndex((i) => Math.min(pendingVideos.length - 1, i + 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {urlError && (
        <p className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {urlError}
        </p>
      )}

      <InternalReviewPanel
        video={panelVideo}
        role={role}
        userId={userId}
        pending={pending}
        onDecision={decide}
      />
    </div>
  )
}
