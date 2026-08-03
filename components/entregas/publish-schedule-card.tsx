'use client'

import { useState } from 'react'
import { CalendarClock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publishSchedule, formatScheduleLabel } from '@/lib/utils/publish-schedule'
import { validateScheduleOverride, toDatetimeLocalValue } from '@/lib/utils/publish-override'
import { useHasPermission } from '@/components/auth/role-gate'
import { PublishCardButton } from './publish-card-button'

/**
 * The Publicación slot on an entrega card: what Metricool will receive, plus a
 * way to change it before sending.
 *
 * Metricool rejects a past datetime with a 400, and the planned slot goes stale
 * on its own — a batch planned for today at 10:00 is unsendable from 10:01. So
 * the card both WARNS when the computed slot has passed and lets you pick
 * another time, instead of failing at the API and making you go edit the idea.
 *
 * The chosen time applies to the whole batch: the card sends every video in it.
 */
export function PublishScheduleCard({
  ideaIds,
  publishDate,
  postingTime,
}: {
  ideaIds: string[]
  publishDate: string | null
  postingTime: string | null
}) {
  const canPublish = useHasPermission('posting.publish')
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string | null>(null)

  const planned = publishSchedule(publishDate ?? null, postingTime)
  const plannedCheck = validateScheduleOverride(toDatetimeLocalValue(planned.iso))

  // The picker opens on something sendable: the planned slot if it still works,
  // otherwise the same clock time tomorrow.
  const defaultValue = plannedCheck.ok
    ? toDatetimeLocalValue(planned.iso)
    : toDatetimeLocalValue(planned.iso, 24 * 60 * 60 * 1000)

  const override = value ?? (editing ? defaultValue : null)
  const check = override ? validateScheduleOverride(override) : plannedCheck
  const shownIso = override && check.ok ? check.iso : planned.iso

  // Only a valid hand-picked time is sent; otherwise the server keeps its own
  // planned-date logic (and the button is disabled anyway).
  const overrideForSend = override && check.ok ? check.iso.slice(0, 16) : undefined

  function restore() {
    setValue(null)
    setEditing(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
        <div className="flex items-center justify-between gap-x-2">
          <p className="flex min-w-0 items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="truncate">Borrador en Metricool</span>
          </p>
          {canPublish && !editing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              className="shrink-0 whitespace-nowrap rounded px-1 text-[9px] font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
            >
              Cambiar fecha y hora
            </button>
          )}
        </div>

        <p className={cn('text-[11px] font-semibold tabular-nums', override && check.ok && 'text-foreground')}>
          {formatScheduleLabel(shownIso)}
        </p>

        {/* Sin override el aviso describe la fecha planificada; con override, la elegida. */}
        {!check.ok && (
          <p className="text-[9px] font-medium text-red-600 dark:text-red-400">{check.error}</p>
        )}
        {check.ok && planned.clamped && !override && (
          <p className="text-[9px] text-amber-600 dark:text-amber-400">
            {publishDate ? 'Fecha pasada — se corre a +24h' : 'Sin fecha planificada — se corre a +24h'}
          </p>
        )}
        {override && check.ok && (
          <p className="text-[9px] text-muted-foreground">Fecha y hora elegidas a mano</p>
        )}

        {editing && (
          <div className="mt-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`sched-${ideaIds[0]}`} className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
              Fecha y hora
            </label>
            <input
              id={`sched-${ideaIds[0]}`}
              type="datetime-local"
              value={override ?? ''}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] tabular-nums outline-none focus:border-foreground/40"
            />
            <div className="flex items-center justify-between gap-x-2">
              <span className="text-[9px] text-muted-foreground">Hora de Puerto Rico</span>
              <button
                type="button"
                onClick={restore}
                className="shrink-0 whitespace-nowrap rounded px-1 text-[9px] font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
              >
                Restaurar
              </button>
            </div>
          </div>
        )}

        {/* Sin override la etiqueta es la fecha del PRIMER video (los demás
            pueden tener otra); con override sí aplica a todos por igual. */}
        {ideaIds.length > 1 && (
          <p className="mt-1 text-[9px] text-muted-foreground">
            {override && check.ok
              ? `Aplica a los ${ideaIds.length} videos del batch`
              : `Fecha del primero · ${ideaIds.length} videos en total`}
          </p>
        )}
      </div>

      <PublishCardButton
        ideaIds={ideaIds}
        scheduleOverride={overrideForSend}
        disabled={!check.ok}
      />
    </div>
  )
}
