'use client'

import { useState } from 'react'
import { Check, RotateCcw, Send, Lock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { canReviewVideo, reviewState, type ReviewTone } from '@/lib/utils/internal-review'
import type { IdeaApprovalStatus, UserRole } from '@/lib/supabase/types'

/**
 * The INTERNAL review card: a teammate watches the edited video and either
 * approves it — sending it on to Copy — or returns it to the editor with the
 * changes. Deliberately separate from the client-facing approval link.
 */

export interface ReviewVideo {
  id: string
  title: string
  clientName: string
  /** Edited file the reviewer actually watches. null = nothing uploaded yet. */
  editedUrl: string | null
  approval_status: IdeaApprovalStatus
  submitted_by?: string | null
  submittedByName?: string | null
  /** What the reviewer asked to change, shown back to the editor. */
  reviewNote?: string | null
}

const TONE: Record<ReviewTone, string> = {
  waiting: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  warn: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  muted: 'border-border bg-muted/50 text-muted-foreground',
}

export function InternalReviewPanel({
  video,
  role,
  userId,
  onDecision,
  pending = false,
}: {
  video: ReviewVideo
  role: UserRole | null | undefined
  userId: string | null | undefined
  onDecision: (decision: 'approve' | 'request_changes', note: string) => void
  pending?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')

  const state = reviewState(video.approval_status)
  const canReview = canReviewVideo(role, video, userId)
  const isOwnSubmission =
    !!video.submitted_by && !!userId && video.submitted_by === userId && video.approval_status === 'submitted'

  return (
    <article className="animate-in fade-in slide-in-from-bottom-1 duration-300 overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{video.title}</h3>
          <p className="truncate text-xs text-muted-foreground">{video.clientName}</p>
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium',
            TONE[state.tone],
          )}
        >
          {state.label}
        </span>
      </header>

      <div className="bg-black/90">
        {video.editedUrl ? (
          <video src={video.editedUrl} controls playsInline className="max-h-[320px] w-full object-contain" />
        ) : (
          <div className="grid h-40 place-items-center text-xs text-muted-foreground">
            Todavía no hay video editado
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        {video.submittedByName && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Enviado a revisión por <span className="font-medium text-foreground">{video.submittedByName}</span>
          </p>
        )}

        {video.approval_status === 'revision_needed' && video.reviewNote && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
              Nota del revisor
            </p>
            <p className="mt-1 text-sm">{video.reviewNote}</p>
          </div>
        )}

        {canReview && !asking && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => onDecision('approve', '')}>
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Aprobar
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setAsking(true)}>
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Pedir cambios
            </Button>
          </div>
        )}

        {canReview && asking && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Qué hay que cambiar? El editor verá esta nota."
              rows={3}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || !note.trim()}
                onClick={() => onDecision('request_changes', note.trim())}
              >
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Enviar al editor
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setAsking(false); setNote('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {isOwnSubmission && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            No puedes revisar tu propio video — que lo apruebe un compañero.
          </p>
        )}
      </div>
    </article>
  )
}
