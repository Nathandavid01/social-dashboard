'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Send, Pencil, Lock } from 'lucide-react'
import {
  submitClientReviewAction,
  addClientReviewCommentAction,
} from '@/lib/actions/review-client-actions'
import {
  reviewDecisionSummary,
  canClientChangeVote,
  type ClientReviewStatus,
} from '@/lib/utils/review-link-core'

const TONE: Record<'neutral' | 'success' | 'warning', { box: string; head: string }> = {
  neutral: { box: 'border bg-muted/40', head: 'text-foreground' },
  success: {
    box: 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30',
    head: 'text-green-700 dark:text-green-400',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30',
    head: 'text-amber-700 dark:text-amber-400',
  },
}

/**
 * The client's Aprobar / Rechazar / Comentar controls on the public review page.
 * Leads with a decision-state banner that clearly confirms the client's vote
 * (not just a fleeting toast).
 *
 * After a REJECTION the buttons collapse behind a "cambiar decisión" affordance.
 * After an APPROVAL they're gone for good: approving schedules the video in
 * Metricool and we don't pull a scheduled post back down, so an "undo" would be a
 * promise we can't keep. Commenting stays open either way. The RPC (migration
 * 0044) enforces the same rule — these buttons are only the courtesy.
 *
 * Renders nothing once expired — the DB blocks the writes too.
 */
export function ReviewActions({
  token,
  currentStatus,
  reviewerName,
  expired,
}: {
  token: string
  currentStatus: ClientReviewStatus
  reviewerName?: string | null
  expired: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(reviewerName?.trim() ?? '')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const hasVoted = currentStatus !== 'pending'
  // Approving is final (it schedules the post). Rejecting stays changeable.
  const canChange = canClientChangeVote(currentStatus)
  // Derive the collapse from the real status (+ an explicit "changing" override)
  // so there's never a stale/broken banner during the async refresh window.
  const [changing, setChanging] = useState(false)
  const showButtons = !hasVoted || (changing && canChange)

  if (expired) return null

  const summary = reviewDecisionSummary(currentStatus, reviewerName)
  const tone = TONE[summary.tone]

  function decide(decision: 'approved' | 'rejected') {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await submitClientReviewAction(token, decision, name)
      if (res.error) {
        setError(res.error)
        return
      }
      setChanging(false)
      router.refresh()
    })
  }

  function sendComment() {
    if (!comment.trim()) return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await addClientReviewCommentAction(token, name, comment)
      if (res.error) {
        setError(res.error)
        return
      }
      setComment('')
      setNotice('Comentario enviado.')
      router.refresh()
    })
  }

  return (
    <section className="mt-6 space-y-4 rounded-2xl border bg-card p-4">
      {/* Decision-state banner */}
      <div className={`rounded-xl border px-4 py-3 ${tone.box}`}>
        <p className={`text-sm font-semibold ${tone.head}`}>{summary.headline}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{summary.sub}</p>
      </div>

      {showButtons ? (
        <>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="review-name"
            >
              Tu nombre (opcional)
            </label>
            <input
              id="review-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('approved')}
              aria-pressed={currentStatus === 'approved'}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Aprobar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('rejected')}
              aria-pressed={currentStatus === 'rejected'}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/40"
            >
              <X className="h-4 w-4" /> Rechazar
            </button>
          </div>

          {/* Approving is irreversible — say so BEFORE the click, not after. */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Al aprobar, el video queda <strong className="font-medium text-foreground">programado
            para publicarse</strong> en su fecha, y{' '}
            <strong className="font-medium text-foreground">la aprobación ya no se puede
            deshacer</strong>. Si tienes dudas, déjanos un comentario antes de aprobar.
          </p>
        </>
      ) : canChange ? (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" /> ¿Cambiar tu decisión?
        </button>
      ) : (
        // Approved: the video is scheduled. Don't offer a change we can't honor —
        // point them at the one thing that DOES reach the team.
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ya aprobaste este video y quedó programado para publicarse, así que la decisión no se
            puede cambiar. ¿Necesitas algo? Escríbenos un comentario aquí abajo.
          </span>
        </p>
      )}

      {/* Comment (always available) */}
      <div className="space-y-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escribe un comentario…"
          rows={3}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={sendComment}
          className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Enviar comentario
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="text-sm text-green-600 dark:text-green-400">{notice}</p>}
    </section>
  )
}
