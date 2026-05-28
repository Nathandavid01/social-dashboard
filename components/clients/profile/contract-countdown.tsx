import { FileSignature, CalendarClock, CalendarX } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  expiresAt: string | null
}

function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00').getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export function ContractCountdown({ expiresAt }: Props) {
  if (!expiresAt) {
    return (
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-muted px-2 py-1.5 text-muted-foreground md:flex-row md:items-end md:gap-2 md:px-3 md:py-2">
        <FileSignature className="h-4 w-4 shrink-0" />
        <div className="text-center md:text-right">
          <p className="text-[10px] uppercase tracking-wide opacity-80 md:text-xs">Contrato</p>
          <p className="text-xs font-semibold md:text-sm">Sin fechas</p>
        </div>
      </div>
    )
  }

  const days = daysUntil(expiresAt)
  const expired = days < 0
  const critical = days >= 0 && days <= 14
  const warning = days > 14 && days <= 45

  const Icon = expired ? CalendarX : CalendarClock
  const cls = expired
    ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse'
    : critical
      ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
      : warning
        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
        : 'bg-green-500/10 text-green-500 border-green-500/30'

  const label = expired
    ? `Vencido ${Math.abs(days)}d`
    : days === 0
      ? 'Vence hoy'
      : `${days} día${days === 1 ? '' : 's'}`

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 md:flex-row md:items-end md:gap-2 md:px-3 md:py-2',
        cls,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="text-center md:text-right">
        <p className="text-[10px] uppercase tracking-wide opacity-80 md:text-xs">Contrato</p>
        <p className="text-xs font-semibold md:text-sm">{label}</p>
      </div>
    </div>
  )
}
