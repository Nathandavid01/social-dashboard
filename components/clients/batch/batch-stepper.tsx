import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepperStage } from '@/lib/utils/batch-view'

/**
 * Beginner-friendly stage stepper. Shows the whole 7-step pipeline so anyone
 * opening a client immediately sees where the batch is and what's left — done
 * stages in green, the current stage highlighted with an "AQUÍ" marker.
 */
export function BatchStepper({ stages }: { stages: StepperStage[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
              s.done && 'bg-emerald-500/10 text-emerald-500',
              s.current && 'bg-primary/15 text-primary ring-1 ring-primary',
              !s.done && !s.current && 'bg-card text-muted-foreground ring-1 ring-border',
            )}
            data-state={s.current ? 'current' : s.done ? 'done' : 'todo'}
          >
            {s.done ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : (
              <span className="text-[11px] font-bold tabular-nums">{i + 1}</span>
            )}
            {s.label}
            {s.current && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary-foreground">
                AQUÍ
              </span>
            )}
          </span>
          {i < stages.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
          )}
        </div>
      ))}
    </div>
  )
}
