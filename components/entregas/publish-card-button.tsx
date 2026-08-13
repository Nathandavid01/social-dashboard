'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { publishIdeaToMetricool } from '@/lib/actions/idea-posting'
import { useHasPermission } from '@/components/auth/role-gate'

/**
 * "Enviar a Metricool" on a Publicación card.
 *
 * The card is a client batch, so this sends every video in it — one at a time,
 * not in parallel: each publish uploads media and hits Metricool, and firing
 * five at once is how you get half of them rejected with no way to tell which.
 *
 * runIdeaPost is idempotent (it claims the row and skips anything already
 * posted), so a double click can't double-post.
 */
export function PublishCardButton({
  ideaIds,
  disabled,
  scheduleOverride,
}: {
  ideaIds: string[]
  disabled?: boolean
  /** Hand-picked "YYYY-MM-DDTHH:MM" (PR wall-clock) — applies to every video in the card. */
  scheduleOverride?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  // La server action también lo exige; sin esto el botón se ofrece para fallar.
  const canPublish = useHasPermission('posting.publish')

  async function send(e: React.MouseEvent) {
    // The whole card is a click target that opens the overlay — publishing
    // must not open it too.
    e.stopPropagation()
    if (busy || ideaIds.length === 0) return

    setBusy(true)
    setDone(0)
    let ok = 0
    const errors: string[] = []

    for (const id of ideaIds) {
      const res = await publishIdeaToMetricool(id, scheduleOverride, { watchedOn: 'entregas' })
      if (res.error) errors.push(res.error)
      else if (res.skipped) errors.push(res.skipped)
      else ok++
      setDone((d) => d + 1)
    }

    setBusy(false)

    if (ok > 0) {
      toast({ title: `${ok} video${ok === 1 ? '' : 's'} enviado${ok === 1 ? '' : 's'} a Metricool` })
    }
    if (errors.length > 0) {
      toast({
        title: `${errors.length} no se pudo enviar`,
        description: errors[0],
        variant: 'destructive',
      })
    }
    router.refresh()
  }

  if (!canPublish) return null

  return (
    <Button
      size="sm"
      className="w-full"
      disabled={busy || disabled}
      onClick={send}
    >
      {busy ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Enviando {done}/{ideaIds.length}…
        </>
      ) : (
        <>
          <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Enviar a Metricool
          {ideaIds.length > 1 && ` (${ideaIds.length})`}
        </>
      )}
    </Button>
  )
}
