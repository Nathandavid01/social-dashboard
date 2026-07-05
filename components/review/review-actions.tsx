'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Send, Pencil } from 'lucide-react'
import {
  submitClientReviewAction,
  addClientReviewCommentAction,
} from '@/lib/actions/review-client-actions'
import { reviewDecisionSummary, type ClientReviewStatus } from '@/lib/utils/review-link-core'

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
 * (not just a fleeting toast); once voted, the buttons collapse behind a
 * "cambiar decisión" affordance (re-voting is allowed until the link expires).
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
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const hasVoted = currentStatus !== 'pending'
  const [showButtons, setShowButtons] = useState(!hasVoted)

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
      setShowButtons(false)
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
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowButtons(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" /> ¿Cambiar tu decisión?
        </button>
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
