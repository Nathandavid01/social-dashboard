'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SocialPlatform } from '@/lib/supabase/types'

/**
 * The Copy column, one video at a time. Same shape as ReviewQueue: the board
 * groups by client, but a copy is written per video — "Caption único", one text
 * for all of the client's networks (see IdeaCaptionEditor).
 *
 * The editor is injected rather than imported so this stays testable and the
 * preview route can render it without calling server actions. The real page
 * passes <IdeaCaptionEditor>.
 *
 * Writing the copy is what moves a video on: ideaStage() sends an approved video
 * with a non-empty generated_caption to Publicación.
 */

export interface CopyVideo {
  /** content_ideas.id */
  id: string
  title: string
  clientName: string
  generated_caption: string | null
  platforms?: SocialPlatform[]
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtags?: string | null
}

const written = (c: string | null | undefined) => !!c && c.trim().length > 0

export function CopyQueue({
  videos,
  renderEditor,
}: {
  videos: CopyVideo[]
  /** Real page: <IdeaCaptionEditor ideaId=… onSaved=…>. */
  renderEditor: (video: CopyVideo, onSaved: (caption: string) => void) => React.ReactNode
}) {
  // Local layer so the queue advances without waiting for the board to refetch.
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)

  const captionOf = useCallback(
    (v: CopyVideo) => saved[v.id] ?? v.generated_caption,
    [saved],
  )

  const pendingVideos = useMemo(
    () => videos.filter((v) => !written(captionOf(v))),
    [videos, captionOf],
  )
  const doneCount = videos.length - pendingVideos.length
  const current = pendingVideos[Math.min(index, Math.max(0, pendingVideos.length - 1))] ?? null

  function onSaved(caption: string) {
    if (!current) return
    setSaved((s) => ({ ...s, [current.id]: caption }))
    setIndex(0) // the next one without copy slides into place
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="text-sm font-medium">No queda copy por escribir</p>
        <p className="text-xs text-muted-foreground">
          {videos.length} video{videos.length === 1 ? '' : 's'} listo{videos.length === 1 ? '' : 's'} para Publicación.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">
          {doneCount} de {videos.length} con copy
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

      <article className="overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{current.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{current.clientName}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-[11px] font-medium text-pink-600 dark:text-pink-400">
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Falta el copy
          </span>
        </header>
        <div className="p-4">{renderEditor(current, onSaved)}</div>
      </article>
    </div>
  )
}
