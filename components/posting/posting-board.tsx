'use client'

import { useState } from 'react'
import { PostingCard } from './posting-card'
import { Send, CheckCircle2 } from 'lucide-react'
import type { PostingQueueItem } from '@/lib/actions/posting'

interface PostingBoardProps {
  initialPending: PostingQueueItem[]
  initialSent: PostingQueueItem[]
}

export function PostingBoard({ initialPending, initialSent }: PostingBoardProps) {
  const [pending, setPending] = useState(initialPending)
  const [sent, setSent] = useState(initialSent)

  function handleSent(item: PostingQueueItem, draft: PostingQueueItem['draft']) {
    setPending((p) => p.filter((x) => x.review.id !== item.review.id))
    if (draft) setSent((s) => [{ ...item, draft }, ...s])
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
          <Send className="h-3.5 w-3.5" />
          LISTOS PARA PUBLICAR ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No hay videos aprobados pendientes de publicar.{' '}
            <a href="/video-reviews" className="text-primary hover:underline">
              Ver Video QC
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((item) => (
              <PostingCard
                key={item.review.id}
                item={item}
                onSent={(draft) => handleSent(item, draft)}
              />
            ))}
          </div>
        )}
      </section>

      {sent.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ENVIADOS A METRICOOL ({sent.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sent.map((item) => (
              <PostingCard key={item.review.id} item={item} readonly />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
