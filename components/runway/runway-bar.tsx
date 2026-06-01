import { cn } from '@/lib/utils'
import { TARGET_WEEKS } from '@/lib/utils/content-runway'

export function weekColor(weeks: number | null): string {
  if (weeks === null) return 'bg-muted'
  if (weeks >= TARGET_WEEKS) return 'bg-emerald-500'
  if (weeks >= 2) return 'bg-amber-500'
  return 'bg-red-500'
}

/** One stage's runway: the label + weeks number + a bar filled toward the 1-month target. */
export function RunwayBar({ label, weeks }: { label: string; weeks: number | null }) {
  const pct = weeks === null ? 0 : Math.min(100, Math.round((weeks / TARGET_WEEKS) * 100))
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{weeks === null ? '—' : `${weeks} sem`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', weekColor(weeks))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
