'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { updateClientCadence } from '@/lib/actions/client-cadence'
import { dayLabelsFull, dayLabelsShort } from '@/lib/utils/posting-cadence'
import {
  CADENCE_TIMEZONES,
  formatCadenceSummaryEs,
  readClientCadence,
  type ClientPostingCadence,
} from '@/lib/utils/client-cadence'

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface Props {
  clientId: string
  initialDays: number[]
  initialTime: string | null
  initialSchedule: Record<string, string>
  initialTimezone: string | null
  compact?: boolean
}

export function ClientCadenceEditor({
  clientId,
  initialDays,
  initialTime,
  initialSchedule,
  initialTimezone,
  compact = false,
}: Props) {
  const canEdit = useHasPermission('cadence.edit')
  const { toast } = useToast()
  const [days, setDays] = useState<number[]>(initialDays)
  const [time, setTime] = useState(initialTime ?? '')
  const [schedule, setSchedule] = useState<Record<string, string>>(initialSchedule ?? {})
  const [timezone, setTimezone] = useState(initialTimezone ?? '')
  const [isPending, startTransition] = useTransition()

  const cadence: ClientPostingCadence = readClientCadence({
    posting_days: days,
    posting_time: time || null,
    posting_schedule: schedule,
    posting_timezone: timezone || null,
  })

  function persist(patch: Parameters<typeof updateClientCadence>[1], rollback: () => void) {
    startTransition(async () => {
      const res = await updateClientCadence(clientId, patch)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        rollback()
      }
    })
  }

  function toggleDay(d: number) {
    if (!canEdit) return
    const prev = days
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)
    const nextSchedule = { ...schedule }
    if (!next.includes(d)) delete nextSchedule[String(d)]
    setDays(next)
    setSchedule(nextSchedule)
    persist({ posting_days: next, posting_schedule: nextSchedule }, () => {
      setDays(prev)
      setSchedule(schedule)
    })
  }

  function saveDefaultTime(next: string) {
    if (!canEdit) return
    const prev = time
    setTime(next)
    persist({ posting_time: next || null }, () => setTime(prev))
  }

  function saveOverride(day: number, next: string) {
    if (!canEdit) return
    const prev = schedule
    const nextSchedule = { ...schedule }
    if (next) nextSchedule[String(day)] = next
    else delete nextSchedule[String(day)]
    setSchedule(nextSchedule)
    persist({ posting_schedule: nextSchedule }, () => setSchedule(prev))
  }

  function saveTimezone(next: string) {
    if (!canEdit) return
    const prev = timezone
    setTimezone(next)
    persist({ posting_timezone: next || null }, () => setTimezone(prev))
  }

  const activeDays = DAYS_ORDER.filter((d) => days.includes(d))

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground" data-testid="cadence-frequency">
          {cadence.postsPerWeek > 0 ? (
            <>
              <strong className="tabular-nums text-foreground">{cadence.postsPerWeek}</strong>
              {cadence.postsPerWeek === 1 ? ' publicación / semana' : ' publicaciones / semana'}
            </>
          ) : (
            'Sin cadencia — elige los días en que este cliente publica.'
          )}
        </p>
        {isPending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Días preferidos</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_ORDER.map((d) => {
            const active = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                disabled={!canEdit || isPending}
                aria-pressed={active}
                aria-label={dayLabelsFull[d]}
                data-testid={`cadence-day-${d}`}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-all',
                  canEdit && 'hover:scale-105 active:scale-95',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40',
                  (!canEdit || isPending) && 'cursor-default opacity-80',
                )}
              >
                {dayLabelsShort[d]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Hora preferida
          <input
            type="time"
            value={time}
            onChange={(e) => saveDefaultTime(e.target.value)}
            disabled={!canEdit || isPending}
            aria-label="Hora preferida"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Zona horaria
          <select
            value={timezone}
            onChange={(e) => saveTimezone(e.target.value)}
            disabled={!canEdit || isPending}
            aria-label="Zona horaria"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
          >
            <option value="">Sin zona horaria</option>
            {CADENCE_TIMEZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeDays.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Hora por día (opcional)</p>
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {activeDays.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-sm">{dayLabelsFull[d]}</span>
                <input
                  type="time"
                  value={schedule[String(d)] ?? ''}
                  placeholder={time || undefined}
                  onChange={(e) => saveOverride(d, e.target.value)}
                  disabled={!canEdit || isPending}
                  aria-label={`Hora del ${dayLabelsFull[d]}`}
                  className={cn(
                    'w-28 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums',
                    'focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70',
                    !schedule[String(d)] && 'text-muted-foreground',
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground" data-testid="cadence-summary">
        {formatCadenceSummaryEs(cadence)}
      </p>
    </div>
  )
}
