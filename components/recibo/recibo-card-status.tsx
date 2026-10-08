'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { setManualPostedStatus, setStaffClientApproval, type ManualPostedStatus } from '@/lib/actions/recibo'
import { crearEnlaceCliente } from '@/lib/actions/entregas-client-review'
import { cancelReciboSchedule, publishReciboOnCadence } from '@/lib/actions/recibo-publish'
import { useHasPermission } from '@/components/auth/role-gate'
import { manualCadenceSlot, nextCadenceSlot, reciboScheduleTarget, type CadenceSlot } from '@/lib/recibo/cadence-slot'
import { parseSlotTime } from '@/lib/utils/posting-schedule'
import { cn } from '@/lib/utils'

export function ReciboStatusMarks({
  ideaId,
  clientId,
  approved,
  sent,
  postedStatus = null,
  hidePublished = false,
}: {
  ideaId: string
  clientId: string
  approved: boolean
  sent: boolean
  /** manual_posted_status now: Deshacer puts this back. */
  postedStatus?: ManualPostedStatus
  hidePublished?: boolean
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
                else setPublished(false)
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
      {hidePublished ? null : (
        <Mark on={isPublished} disabled={pending || isPublished} onClick={markPublished} label="Publicado" />
      )}
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
  spaceDateISO = null,
  nowMs,
  scheduled = false,
  editMode,
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
  spaceDateISO?: string | null
  nowMs?: number
  scheduled?: boolean
  editMode: 'ai' | 'human'
}) {
  const { toast } = useToast()
  const router = useRouter()
  const canPublish = useHasPermission('posting.publish')
  const [pending, start] = useTransition()
  const [pickedDate, setPickedDate] = useState(() => {
    const slot = reciboScheduleTarget({
      spaceDateISO,
      postingDays: cadence.postingDays,
      postingTime: cadence.postingTime,
      postingSchedule: cadence.postingSchedule,
      todayISO,
      nowMs,
    })
    if (!slot.ok && slot.dateISO && (slot.reason === 'sin-hora' || slot.reason === 'sin-dias')) return slot.dateISO
    return ''
  })
  const [pickedTime, setPickedTime] = useState('')
  const [isScheduled, setIsScheduled] = useState(scheduled)
  const [scheduledLabel, setScheduledLabel] = useState<string | null>(null)
  const [changingDate, setChangingDate] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const activeDate = changingDate ? pickedDate : (pickedDate || spaceDateISO)
  const target: CadenceSlot = reciboScheduleTarget({
    spaceDateISO: activeDate,
    postingDays: cadence.postingDays,
    postingTime: cadence.postingTime,
    postingSchedule: cadence.postingSchedule,
    todayISO,
    nowMs,
  })
  const currentSlot = reciboScheduleTarget({
    spaceDateISO,
    postingDays: cadence.postingDays,
    postingTime: cadence.postingTime,
    postingSchedule: cadence.postingSchedule,
    todayISO,
    nowMs,
  })
  const nextSlot = nextCadenceSlot({
    postingDays: cadence.postingDays,
    postingTime: cadence.postingTime,
    postingSchedule: cadence.postingSchedule,
    todayISO,
  })
  const past = target.ok === false && target.reason === 'pasado'
  const needsManual = target.ok === false && (target.reason === 'sin-hora' || target.reason === 'sin-dias')
  const showDateField = past || changingDate || needsManual
  const showTimeField = needsManual || (changingDate && !currentSlot.ok)
  const parsedTime = parseSlotTime(pickedTime)
  const manualSlot = needsManual && pickedDate && parsedTime ? manualCadenceSlot(pickedDate, parsedTime) : null
  const programmedText = scheduledLabel
    ?? (currentSlot.ok ? currentSlot.label : spaceDateISO)

  let hint = ''
  if (isScheduled && !changingDate && !confirmCancel) hint = ''
  else if (!approved) hint = 'Márcalo aprobado para programarlo.'
  else if (!cadence.metricool) hint = 'A este cliente le falta Metricool.'
  else if (past) hint = `El espacio era ${target.label ?? spaceDateISO}. Esa fecha ya pasó; no se programa en el pasado.`
  else if (!target.ok && target.reason === 'sin-hora') hint = 'Este cliente no tiene hora de publicación; escógela aquí'
  else if (!target.ok && target.reason === 'sin-dias') hint = 'Este cliente no tiene días de publicación; escoge fecha y hora aquí'

  const dateToSend = target.ok ? target.dateISO : (needsManual ? pickedDate || null : null)
  const manualReady = Boolean(needsManual && pickedDate && parsedTime && pickedDate >= todayISO)
  const canSchedule = Boolean(approved && cadence.metricool && ((target.ok && dateToSend) || manualReady))
  const label = isScheduled && !changingDate
    ? `Programado ${programmedText}`
    : manualSlot?.ok
      ? `Programar para ${manualSlot.label}`
      : target.ok
        ? `Programar para ${target.label}`
        : 'Programar en Metricool'

  function publish() {
    if (!canSchedule) return
    const manualTime = needsManual || showTimeField ? parsedTime : null
    const date = target.ok ? target.dateISO : pickedDate
    if (!date) return
    if ((needsManual || showTimeField) && !manualTime) return
    start(async () => {
      const res = manualTime
        ? await publishReciboOnCadence(ideaId, date, manualTime)
        : await publishReciboOnCadence(ideaId, date)
      if (res.error) toast({ title: 'No se programó', description: res.error, variant: 'destructive' })
      else {
        setIsScheduled(true)
        setChangingDate(false)
        setScheduledLabel(res.label ?? (target.ok ? target.label : date))
        toast({ title: `Programado ${res.label ?? date}`, description: 'Quedó como borrador en Metricool. No se publica solo.' })
        router.refresh()
      }
    })
  }

  function cancelSchedule() {
    start(async () => {
      const res = await cancelReciboSchedule(ideaId)
      if (res.error) {
        toast({ title: 'No se canceló', description: res.error, variant: 'destructive' })
        return
      }
      setIsScheduled(false)
      setConfirmCancel(false)
      setScheduledLabel(null)
      setPickedDate('')
      setPickedTime('')
      toast({
        title: 'Programación cancelada',
        description: res.leftoverDraft
          ? (res.message ?? 'Quedó como borrador en Metricool para revisión.')
          : 'Se quitó de Metricool. El espacio volvió a Recibo.',
      })
      router.refresh()
    })
  }

  if (editMode !== 'ai') {
    if (!canPublish) {
      return isScheduled ? (
        <p className="px-3 pb-3 text-xs font-semibold text-violet-100">Programado {programmedText}</p>
      ) : null
    }
    return (
      <div className="px-3 pb-3">
        {isScheduled ? (
          <p className="mb-2 text-xs font-semibold text-violet-100">Programado {programmedText}</p>
        ) : null}
        <p className="text-[11px] leading-snug text-muted-foreground">Solo clientes AI se programan desde Recibo</p>
      </div>
    )
  }

  if (!canPublish) {
    return isScheduled ? (
      <p className="px-3 pb-3 text-xs font-semibold text-violet-100">Programado {programmedText}</p>
    ) : null
  }

  return (
    <div className="px-3 pb-3">
      {isScheduled && !changingDate ? (
        <p className="mb-2 text-xs font-semibold text-violet-100">{pending ? 'Programando…' : `Programado ${programmedText}`}</p>
      ) : null}
      {showDateField ? (
        <label className="mb-2 block text-[11px] text-amber-200">
          {needsManual && !past && !changingDate ? 'Fecha de publicación' : 'Nueva fecha'}
          <input
            type="date"
            min={todayISO}
            value={pickedDate}
            onChange={(event) => setPickedDate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-500/40 bg-black/40 px-2 py-1.5 text-xs text-foreground"
          />
        </label>
      ) : null}
      {showTimeField ? (
        <label className="mb-2 block text-[11px] text-amber-200">
          Hora de publicación
          <input
            type="time"
            value={pickedTime}
            onChange={(event) => setPickedTime(event.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-500/40 bg-black/40 px-2 py-1.5 text-xs text-foreground"
          />
        </label>
      ) : null}
      {showDateField && (nextSlot.ok || nextSlot.dateISO) ? (
        <button
          type="button"
          onClick={() => { if (nextSlot.dateISO) setPickedDate(nextSlot.dateISO) }}
          className="mb-2 text-left text-[11px] font-medium text-violet-300"
        >
          Usar próximo de cadencia · {nextSlot.label}
        </button>
      ) : null}
      {isScheduled && !changingDate ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => { setChangingDate(true); setConfirmCancel(false) }}
            className="w-full rounded-xl bg-violet-500/15 px-3 py-2 text-left text-xs font-semibold text-violet-100 disabled:opacity-70"
          >
            Cambiar fecha
          </button>
          {confirmCancel ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="text-[11px] text-amber-100">¿Quitar este video de Metricool y devolver el espacio?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={cancelSchedule}
                  className="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-100"
                >
                  Sí, cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmCancel(true)}
              className="w-full rounded-xl bg-black/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground disabled:opacity-70"
            >
              Cancelar programación
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || !canSchedule || (isScheduled && !changingDate)}
          onClick={publish}
          className="w-full rounded-xl bg-violet-500/15 px-3 py-2 text-left text-xs font-semibold text-violet-100 disabled:opacity-70"
        >
          {pending ? 'Programando…' : changingDate ? 'Guardar nueva fecha' : label}
        </button>
      )}
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
