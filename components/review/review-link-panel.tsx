'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Link2, Copy, Check, Send } from 'lucide-react'
import { useHasPermission } from '@/components/auth/role-gate'
import {
  generateReviewLink,
  getReviewStaffView,
  addStaffReviewComment,
  type StaffReviewView,
} from '@/lib/actions/review-staff'
import {
  clientReviewStatusLabel,
  authorKindLabel,
  formatReviewDateES,
} from '@/lib/utils/review-link-core'

const STATUS_TONE: Record<StaffReviewView['client_review_status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

/**
 * Staff-side review controls on the video work card (Inc 4). Mints/copies the
 * client review link (gated on an edited video existing + `posting.publish`),
 * shows the client's vote + comment thread, and lets staff reply. The client's
 * vote is display-only here — the internal approval + Metricool stay separate.
 */
export function ReviewLinkPanel({
  ideaId,
  hasEditedVideo,
}: {
  ideaId: string
  hasEditedVideo: boolean
}) {
  const canPublish = useHasPermission('posting.publish')
  const canReply = useHasPermission('planning.move')

  const [view, setView] = useState<StaffReviewView | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(() => {
    getReviewStaffView(ideaId).then(setView).catch(() => setView(null))
  }, [ideaId])

  useEffect(() => {
    load()
  }, [load])

  function generate() {
    setError(null)
    startTransition(async () => {
      const res = await generateReviewLink(ideaId)
      if (res.error || !res.url) {
        setError(res.error ?? 'No se pudo generar el link.')
        return
      }
      setUrl(res.url)
      try {
        await navigator.clipboard?.writeText(res.url)
        setCopied(true)
      } catch {
        setCopied(false)
      }
      load()
    })
  }

  function sendReply() {
    if (!reply.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addStaffReviewComment(ideaId, reply)
      if (res.error) {
        setError(res.error)
        return
      }
      setReply('')
      load()
    })
  }

  const status = view?.client_review_status ?? 'pending'
  const comments = view?.comments ?? []

  return (
    <section className="mt-3 space-y-3 rounded-xl border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">Revisión del cliente</span>
        {status !== 'pending' && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}>
            {clientReviewStatusLabel(status)}
            {view?.client_reviewer_name ? ` · ${view.client_reviewer_name}` : ''}
          </span>
        )}
      </div>

      {/* Generate / copy link */}
      {!hasEditedVideo ? (
        <p className="text-[11px] text-muted-foreground">
          Sube el video editado para poder enviarlo al cliente.
        </p>
      ) : canPublish ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={pending}
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {url ? (copied ? 'Link copiado' : 'Copiar link de revisión') : 'Generar link de revisión'}
          </button>
          {url && (
            <p className="break-all rounded bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">{url}</p>
          )}
        </div>
      ) : null}

      {/* Thread */}
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-muted/40 p-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px]">
                <span
                  className={`rounded px-1 py-0.5 font-medium ${
                    c.author_kind === 'client' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {authorKindLabel(c.author_kind)}
                </span>
                <span className="font-medium">{c.author_name}</span>
                <span className="ml-auto text-muted-foreground">{formatReviewDateES(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-xs">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Staff reply */}
      {canReply && (
        <div className="flex items-start gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Responder al cliente…"
            rows={2}
            className="flex-1 resize-y rounded-lg border bg-background px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={pending}
            onClick={sendReply}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Responder
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
