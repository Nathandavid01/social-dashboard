'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'
import { setClientPostingDays } from '@/lib/actions/posting-days'
import { useToast } from '@/lib/hooks/use-toast'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun..Dom

export function InlineDayPicker({ clientId, initial }: { clientId: string; initial: number[] }) {
  const [days, setDays] = useState<number[]>(initial)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function toggle(d: number) {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)
    const prev = days
    setDays(next)
    startTransition(async () => {
      const res = await setClientPostingDays(clientId, next)
      if (res.error) {
        setDays(prev)
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {ORDER.map((d) => (
        <button
          key={d}
          type="button"
          onClick={(e) => { e.preventDefault(); toggle(d) }}
          disabled={isPending}
          aria-pressed={days.includes(d)}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-60',
            days.includes(d)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {dayLabelsShort[d]}
        </button>
      ))}
    </span>
  )
}
