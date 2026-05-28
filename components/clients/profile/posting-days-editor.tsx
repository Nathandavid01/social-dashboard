'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import { dayLabelsShort, computePostingTargets } from '@/lib/utils/posting-cadence'

interface Props {
  clientId: string
  initial: number[]
}

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

export function PostingDaysEditor({ clientId, initial }: Props) {
  const [days, setDays] = useState<number[]>(initial)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function toggle(d: number) {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()
    setDays(next)
    startTransition(async () => {
      const res = await updateClientProfile(clientId, { posting_days: next })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        setDays(days) // rollback
      }
    })
  }

  const targets = computePostingTargets(days)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS_ORDER.map((d) => {
          const active = days.includes(d)
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              disabled={isPending}
              type="button"
              className={cn(
                'group relative rounded-lg border py-2 text-xs font-medium transition-all',
                'hover:scale-105 active:scale-95',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40',
              )}
              aria-pressed={active}
            >
              {dayLabelsShort[d]}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          {targets.perWeek > 0 ? (
            <>
              <strong className="tabular-nums text-foreground">{targets.perWeek}</strong>/sem ·{' '}
              <strong className="tabular-nums text-foreground">{targets.perMonth}</strong>/mes
            </>
          ) : (
            <span>Selecciona días</span>
          )}
        </span>
        {targets.thisWeekRemaining > 0 && (
          <span className="text-foreground">{targets.thisWeekRemaining} restantes esta semana</span>
        )}
      </div>
    </div>
  )
}
