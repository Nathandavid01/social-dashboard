'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  confirmRecordingClient,
  confirmRecordingVideographer,
  unconfirmRecordingClient,
  unconfirmRecordingVideographer,
} from '@/lib/actions/recording-sessions'
import { hasClientConfirmed, hasVideographerConfirmed } from '@/lib/utils/recording-confirmation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  sessionId: string
  clientConfirmedAt?: string | null
  videographerConfirmedAt?: string | null
  /** Compact for Mi Día cards; menu items style for calendar can pass className. */
  className?: string
}

export function RecordingConfirmButtons({
  sessionId,
  clientConfirmedAt,
  videographerConfirmedAt,
  className,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [clientAt, setClientAt] = useState(clientConfirmedAt ?? null)
  const [videoAt, setVideoAt] = useState(videographerConfirmedAt ?? null)
  const [error, setError] = useState('')

  const clientOk = hasClientConfirmed({ client_confirmed_at: clientAt })
  const videoOk = hasVideographerConfirmed({ videographer_confirmed_at: videoAt })
  const both = clientOk && videoOk

  function run(
    action: () => Promise<{ error?: string; client_confirmed_at?: string | null; videographer_confirmed_at?: string | null }>,
    apply: (r: { client_confirmed_at?: string | null; videographer_confirmed_at?: string | null }) => void,
  ) {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
        return
      }
      apply(result)
      router.refresh()
    })
  }

  return (
    <div className={cn('mt-3 space-y-1.5', className)} data-slot="recording-confirm-buttons">
      {both ? (
        <p className="text-xs font-semibold text-emerald-600">Confirmada</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!clientOk ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() =>
              run(
                () => confirmRecordingClient(sessionId),
                (r) => setClientAt(r.client_confirmed_at ?? new Date().toISOString()),
              )
            }
          >
            Confirmar cliente
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={pending}
            onClick={() =>
              run(
                () => unconfirmRecordingClient(sessionId),
                () => setClientAt(null),
              )
            }
          >
            Quitar conf. cliente
          </Button>
        )}
        {!videoOk ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() =>
              run(
                () => confirmRecordingVideographer(sessionId),
                (r) => setVideoAt(r.videographer_confirmed_at ?? new Date().toISOString()),
              )
            }
          >
            Confirmar videógrafo
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={pending}
            onClick={() =>
              run(
                () => unconfirmRecordingVideographer(sessionId),
                () => setVideoAt(null),
              )
            }
          >
            Quitar conf. videógrafo
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
