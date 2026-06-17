'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import { dayLabelsFull } from '@/lib/utils/posting-cadence'

interface Props {
  clientId: string
  postingDays: number[]
  initialTime: string | null
  initialSchedule: Record<string, string>
}

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

export function PostingTimeEditor({ clientId, postingDays, initialTime, initialSchedule }: Props) {
  const [time, setTime] = useState<string>(initialTime ?? '')
  const [schedule, setSchedule] = useState<Record<string, string>>(initialSchedule ?? {})
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function persist(patch: Parameters<typeof updateClientProfile>[1], rollback: () => void) {
    startTransition(async () => {
      const res = await updateClientProfile(clientId, patch)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        rollback()
      }
    })
  }

  function saveDefault(next: string) {
    const prev = time
    setTime(next)
    persist({ posting_time: next || null }, () => setTime(prev))
  }

  function saveOverride(day: number, next: string) {
    const prev = schedule
    const nextSchedule = { ...schedule }
    if (next) nextSchedule[String(day)] = next
    else delete nextSchedule[String(day)]
    setSchedule(nextSchedule)
    persist({ posting_schedule: nextSchedule }, () => setSchedule(prev))
  }

  const activeDays = DAYS_ORDER.filter((d) => postingDays.includes(d))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <label className="text-sm font-medium" htmlFor={`time-${clientId}`}>
          Hora por defecto
        </label>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          <input
            id={`time-${clientId}`}
            type="time"
            value={time}
            onChange={(e) => saveDefault(e.target.value)}
            disabled={isPending}
            className={cn(
              'rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums',
              'focus:outline-none focus:ring-2 focus:ring-primary/40',
            )}
          />
        </div>
      </div>

      {activeDays.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Selecciona días de posting en Resumen para fijar horas por día.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Hora por día (opcional, sobrescribe la de por defecto)</p>
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {activeDays.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-sm">{dayLabelsFull[d]}</span>
                <input
                  type="time"
                  value={schedule[String(d)] ?? ''}
                  placeholder={time || undefined}
                  onChange={(e) => saveOverride(d, e.target.value)}
                  disabled={isPending}
                  className={cn(
                    'w-28 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums',
                    'focus:outline-none focus:ring-2 focus:ring-primary/40',
                    !schedule[String(d)] && 'text-muted-foreground',
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
