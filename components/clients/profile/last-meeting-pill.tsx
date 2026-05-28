import { Users, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  lastMeetingAt: string | null
}

function relativeDays(iso: string): { days: number; label: string } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { days, label: 'En el futuro' }
  if (days === 0) return { days, label: 'Hoy' }
  if (days === 1) return { days, label: 'Ayer' }
  if (days < 30) return { days, label: `Hace ${days} días` }
  const months = Math.round(days / 30)
  return { days, label: `Hace ${months} mes${months === 1 ? '' : 'es'}` }
}

export function LastMeetingPill({ lastMeetingAt }: Props) {
  if (!lastMeetingAt) {
    return (
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-muted px-2 py-1.5 text-muted-foreground md:flex-row md:items-end md:gap-2 md:px-3 md:py-2">
        <UserX className="h-4 w-4 shrink-0" />
        <div className="text-center md:text-right">
          <p className="text-[10px] uppercase tracking-wide opacity-80 md:text-xs">Meeting</p>
          <p className="text-xs font-semibold md:text-sm">Sin registro</p>
        </div>
      </div>
    )
  }

  const { days, label } = relativeDays(lastMeetingAt)
  const stale = days > 30
  const warm = days > 14 && days <= 30

  const cls = stale
    ? 'bg-red-500/10 text-red-500 border-red-500/30'
    : warm
      ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
      : 'bg-green-500/10 text-green-500 border-green-500/30'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 md:flex-row md:items-end md:gap-2 md:px-3 md:py-2',
        cls,
      )}
    >
      <Users className="h-4 w-4 shrink-0" />
      <div className="text-center md:text-right">
        <p className="text-[10px] uppercase tracking-wide opacity-80 md:text-xs">Meeting</p>
        <p className="text-xs font-semibold md:text-sm">{label}</p>
      </div>
    </div>
  )
}
