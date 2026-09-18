import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCadenceSummaryEs, readClientCadence, type ClientCadenceSource } from '@/lib/utils/client-cadence'

export function CadenceSummary({
  source,
  className,
}: {
  source: ClientCadenceSource
  className?: string
}) {
  const cadence = readClientCadence(source)
  const label = formatCadenceSummaryEs(cadence)
  const empty = cadence.postingDays.length === 0
  return (
    <span
      data-testid="cadence-live-summary"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 text-xs',
        empty ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
      title={label}
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}
