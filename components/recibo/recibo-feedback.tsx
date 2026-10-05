'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { MessageSquareWarning, Send } from 'lucide-react'
import { useHasPermission } from '@/components/auth/role-gate'
import { addStaffReviewComment, getReciboReviewComments } from '@/lib/actions/review-staff'
import { useToast } from '@/lib/hooks/use-toast'
import { authorKindLabel, formatReviewDateES, type ReviewComment } from '@/lib/utils/review-link-core'

/**
 * Compact Recibo thread: why this cut does not work, plus any staff/client notes.
 * Write reuses addStaffReviewComment (planning.move). Read is entregas.read.
 */
export function ReciboFeedback({ ideaId }: { ideaId: string }) {
  const canWrite = useHasPermission('planning.move')
  const { toast } = useToast()
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const load = useCallback(() => {
    getReciboReviewComments(ideaId).then(setComments).catch(() => setComments([]))
  }, [ideaId])

  useEffect(() => {
    load()
  }, [load])

  function save() {
    const body = reason.trim()
    if (!body || pending) return
    setError(null)
    start(async () => {
      const res = await addStaffReviewComment(ideaId, body)
      if (res.error) {
        setError(res.error)
        toast({ title: 'No se pudo guardar el motivo', description: res.error, variant: 'destructive' })
        return
      }
      setReason('')
      load()
    })
  }

  if (!canWrite && comments.length === 0) return null

  return (
    <section
      data-testid={`recibo-feedback-${ideaId}`}
      className="space-y-2 border-t border-border px-3 py-3"
      aria-label="Motivo si no te gusta"
    >
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
        <p className="text-xs font-semibold text-foreground">No me gusta · ¿por qué?</p>
      </div>

      {comments.length > 0 && (
        <ul className="space-y-2" data-testid={`recibo-feedback-thread-${ideaId}`}>
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-muted/40 px-2.5 py-2">
              <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
                <span
                  className={`rounded px-1 py-0.5 font-medium ${
                    comment.author_kind === 'client'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {authorKindLabel(comment.author_kind)}
                </span>
                <span className="min-w-0 truncate font-medium">{comment.author_name}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-muted-foreground">
                  {formatReviewDateES(comment.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            aria-label="Por qué no te gusta"
            placeholder="El corte se ve oscuro, el hook no funciona…"
            className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border bg-background/60 px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-violet-400/40"
          />
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-xs font-semibold text-amber-100 disabled:opacity-60 sm:w-auto"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {pending ? 'Guardando…' : 'Guardar motivo'}
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
