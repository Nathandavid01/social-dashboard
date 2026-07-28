'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { discardEntregaVideos } from '@/lib/actions/pipeline-submit'

/**
 * The X that takes a card off the board.
 *
 * Two clicks, not one: the X sits on a card that is itself a click target, and
 * a single-click destructive action there is a misclick waiting to happen. The
 * second click is the confirmation — a modal for this would be heavier than the
 * action deserves.
 */
export function DiscardCardButton({
  ideaIds,
  clientName,
}: {
  ideaIds: string[]
  clientName: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onClick(e: React.MouseEvent) {
    // The card opens an overlay on click — removing it must not open it too.
    e.stopPropagation()
    if (busy) return

    if (!armed) {
      setArmed(true)
      // Disarm on its own: an X left armed is a trap for the next click.
      setTimeout(() => setArmed(false), 3000)
      return
    }

    setBusy(true)
    const res = await discardEntregaVideos(ideaIds)
    setBusy(false)
    setArmed(false)

    if (res.error) {
      toast({ title: 'No se pudo quitar', description: res.error, variant: 'destructive' })
      return
    }
    toast({
      title: `${clientName} — quitado del tablero`,
      description: `${res.count} video${res.count === 1 ? '' : 's'} marcado${res.count === 1 ? '' : 's'} como descartado. No se borró nada.`,
    })
    router.refresh()
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label={armed ? `Confirmar quitar ${clientName} del tablero` : `Quitar ${clientName} del tablero`}
      title={armed ? 'Pulsa otra vez para confirmar' : 'Quitar del tablero'}
      className={cn(
        'grid h-5 shrink-0 place-items-center rounded border backdrop-blur-sm transition',
        armed
          ? 'w-auto gap-1 border-destructive/40 bg-destructive/15 px-1.5 text-[9px] font-semibold text-destructive'
          : 'w-5 border-border bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : armed ? (
        '¿Seguro?'
      ) : (
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  )
}
