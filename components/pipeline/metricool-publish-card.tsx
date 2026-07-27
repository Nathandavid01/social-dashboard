'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { publishSchedule } from '@/lib/utils/publish-schedule'

/**
 * The Publicación card: one thing only — send this video to Metricool, and say
 * exactly when it lands there.
 *
 * The date shown is the one Metricool will actually receive, not the planned
 * publish_date. A past or missing date gets clamped to +24h upstream (so an
 * overdue approval can't fire immediately), and the card says so rather than
 * showing a date that will never happen.
 */

export interface PublishVideo {
  id: string
  title: string
  clientName: string
  publishDate: string | null
  postingTime: string | null
  metricoolPostId: number | null
}

export function MetricoolPublishCard({
  video,
  canPublish,
  onPublish,
  nowMs,
}: {
  video: PublishVideo
  /** `posting.publish` — owner / supervisor. */
  canPublish: boolean
  onPublish: (ideaId: string) => Promise<void>
  nowMs?: number
}) {
  const [pending, setPending] = useState(false)
  const posted = video.metricoolPostId != null
  const s = publishSchedule(video.publishDate, video.postingTime, nowMs)

  async function send() {
    if (pending || posted) return
    setPending(true)
    try {
      await onPublish(video.id)
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-tight">{video.title}</h3>
          <p className="truncate text-[11px] text-muted-foreground">{video.clientName}</p>
        </div>
        {posted && (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            En Metricool
          </span>
        )}
      </div>

      <div className="space-y-1 rounded-lg border bg-muted/30 px-2.5 py-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Se envía para
        </p>
        <p className="text-sm font-semibold tabular-nums">{s.label}</p>
        {s.clamped && (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {video.publishDate ? 'Fecha pasada — se corre a +24h' : 'Sin fecha planificada — se corre a +24h'}
          </p>
        )}
      </div>

      {!posted && canPublish && (
        <Button size="sm" className="w-full" disabled={pending} onClick={send}>
          {pending
            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
            : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
          Enviar a Metricool
        </Button>
      )}
    </article>
  )
}
