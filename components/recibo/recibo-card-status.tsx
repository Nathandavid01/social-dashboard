'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { setManualPostedStatus, setStaffClientApproval, type ManualPostedStatus } from '@/lib/actions/recibo'
import { crearEnlaceCliente } from '@/lib/actions/entregas-client-review'
import { publishReciboOnCadence } from '@/lib/actions/recibo-publish'
import { nextCadenceSlot, type CadenceSlot } from '@/lib/recibo/cadence-slot'
import { cn } from '@/lib/utils'

export function ReciboStatusMarks({
  ideaId,
  clientId,
  approved,
  sent,
  postedStatus = null,
}: {
  ideaId: string
  clientId: string
  approved: boolean
  sent: boolean
  /** manual_posted_status now: Deshacer puts this back. */
  postedStatus?: ManualPostedStatus
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [isApproved, setApproved] = useState(approved)
  const [isSent, setSent] = useState(sent)
  const [isPublished, setPublished] = useState(false)
  const [pending, start] = useTransition()

  function toggleApproved() {
    const next = isApproved ? null : 'approved'
    setApproved(!isApproved)
    start(async () => {
      const res = await setStaffClientApproval({ ideaId, status: next })
      if (res.error) {
        setApproved(isApproved)
        toast({ title: 'No se pudo marcar', description: res.error, variant: 'destructive' })
        return
      }
      router.refresh()
    })
  }

  function markSent() {
    if (isSent) return
    setSent(true)
    start(async () => {
      const res = await crearEnlaceCliente({ clientId, ideaIds: [ideaId] })
      if (res.error) {
        setSent(false)
        toast({ title: 'No se pudo marcar como enviado', description: res.error, variant: 'destructive' })
        return
      }
      router.refresh()
    })
  }

  // For what the Metricool match can't see (posted with another file). The card
  // leaves Recibo on refresh, so the undo lives in the toast.
  function markPublished() {
    if (isPublished) return
    setPublished(true)
    start(async () => {
      const res = await setManualPostedStatus({ ideaId, status: 'posted' })
      if (res.error) {
        setPublished(false)
        toast({ title: 'No se pudo marcar como publicado', description: res.error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Marcado como publicado',
        description: 'Sale de Recibo.',
        action: (
          <ToastAction
            altText="Deshacer"
            onClick={() => {
              void setManualPostedStatus({ ideaId, status: postedStatus }).then((undo) => {
                if (undo.error) toast({ title: 'No se pudo deshacer', description: undo.error, variant: 'destructive' })
                router.refresh()
              })
            }}
          >
            Deshacer
          </ToastAction>
        ),
      })
      router.refresh()
    })
  }

  return (
    <div className="absolute bottom-3 left-3 flex gap-1.5">
      <Mark on={isSent} disabled={pending || isSent} onClick={markSent} label="Enviado" />
      <Mark on={isApproved} disabled={pending} onClick={toggleApproved} label="Aprobado" />
      <Mark on={isPublished} disabled={pending || isPublished} onClick={markPublished} label="Publicado" />
    </div>
  )
}

function Mark({
  on,
  disabled,
  onClick,
  label,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur',
        on ? 'bg-white/90 text-zinc-900' : 'bg-black/45 text-white/80',
        disabled && 'opacity-80',
      )}
    >
      {label}
    </button>
  )
}

export function ReciboPublishButton({
  ideaId,
  approved,
  cadence,
  todayISO,
}: {
  ideaId: string
  approved: boolean
  cadence: {
    postingDays?: number[] | null
    postingTime?: string | null
    postingSchedule?: Record<string, string> | null
    metricool?: boolean
  }
  todayISO: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  const slot: CadenceSlot = nextCadenceSlot({
    postingDays: cadence.postingDays,
    postingTime: cadence.postingTime,
    postingSchedule: cadence.postingSchedule,
    todayISO,
  })

  let label = 'Publicar en Metricool'
  let hint = ''
  if (!approved) hint = 'Márcalo aprobado para publicarlo.'
  else if (!cadence.metricool) hint = 'A este cliente le falta Metricool.'
  else if (!slot.ok && slot.reason === 'sin-dias') hint = 'Agrega los días de publicación en la cadencia del cliente.'
  else if (!slot.ok) hint = 'Agrega la hora de publicación en la cadencia del cliente.'
  else hint = slot.label

  if (slot.ok && approved && cadence.metricool) label = `Publicar en Metricool · ${slot.label}`

  function publish() {
    if (!approved || !cadence.metricool || !slot.ok) return
    start(async () => {
      const res = await publishReciboOnCadence(ideaId)
      if (res.error) toast({ title: 'No se publicó', description: res.error, variant: 'destructive' })
      else {
        toast({ title: 'Quedó en Metricool', description: res.label })
        router.refresh()
      }
    })
  }

  const blocked = !approved || !cadence.metricool || !slot.ok

  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        disabled={pending || blocked}
        onClick={publish}
        className="w-full rounded-xl bg-violet-500/15 px-3 py-2 text-left text-xs font-semibold text-violet-100 disabled:opacity-70"
      >
        {pending ? 'Publicando…' : label}
      </button>
      {blocked && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}
