'use client'

import { NateLogo } from '@/components/shared/nate-logo'
import { ReviewActions } from '@/components/review/review-actions'
import {
  clientReviewStatusLabel,
  expiryNoticeES,
  isReviewExpired,
  authorKindLabel,
  formatReviewDateES,
  type ReviewData,
} from '@/lib/utils/review-link-core'

type ReviewLoad = ReviewData & { video_url: string | null }

const STATUS_TONE: Record<ReviewData['client_review_status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

/**
 * Public, unauthenticated review page (Inc 2: read-only). The client opens this
 * from a WhatsApp link and sees the edited video + caption + comment thread and
 * whether the link is still live. The interactive Aprobar/Rechazar/Comentar form
 * lands in Inc 3 — until then no staff can even mint a link (Inc 4), so nothing
 * routes a real client here yet.
 */
export function ReviewPage({
  review,
  token,
  nowISO,
}: {
  review: ReviewLoad
  token: string
  nowISO: string
}) {
  const expired = isReviewExpired(review.expires_at, nowISO)
  const title = review.title?.trim() || 'Video para revisión'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* Brand header */}
        <div className="mb-6 flex items-center gap-3">
          <NateLogo size={44} />
          <div>
            <p className="text-sm text-muted-foreground">Revisión de contenido</p>
            <h1 className="text-lg font-semibold leading-tight">{review.client_name}</h1>
          </div>
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[review.client_review_status]}`}
          >
            {clientReviewStatusLabel(review.client_review_status)}
          </span>
        </div>

        {/* Video */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {review.video_url ? (
            <video
              controls
              playsInline
              className="aspect-[9/16] max-h-[70vh] w-full bg-black object-contain"
              src={review.video_url}
            >
              Tu navegador no puede reproducir este video.
            </video>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
              El video todavía no está disponible.
            </div>
          )}

          <div className="space-y-3 p-4">
            <h2 className="font-medium">{title}</h2>
            {review.caption ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review.caption}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Sin caption todavía.</p>
            )}
          </div>
        </div>

        {/* Aprobar / Rechazar / Comentar (hidden once expired) */}
        <ReviewActions
          token={token}
          currentStatus={review.client_review_status}
          scheduled={review.scheduled ?? false}
          reviewerName={review.client_reviewer_name}
          expired={expired}
        />

        {/* Expiry notice */}
        <p
          className={`mt-3 text-center text-xs ${expired ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
        >
          {expiryNoticeES(review.expires_at, nowISO)}
          {expired ? ' Este link ya no acepta cambios.' : ''}
        </p>

        {/* Comment thread */}
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold">Comentarios</h3>
          {review.comments.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Aún no hay comentarios.
            </p>
          ) : (
            <ul className="space-y-3">
              {review.comments.map((c) => (
                <li key={c.id} className="rounded-xl border bg-card p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${
                        c.author_kind === 'client'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {authorKindLabel(c.author_kind)}
                    </span>
                    <span className="font-medium">{c.author_name}</span>
                    <span className="ml-auto text-muted-foreground">
                      {formatReviewDateES(c.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
