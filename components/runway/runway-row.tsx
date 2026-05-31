import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ClientLogo } from '@/components/clients/client-logo'
import { TARGET_WEEKS, type Runway, type RunwayStatus } from '@/lib/utils/content-runway'

export interface RunwayRowData {
  clientId: string
  clientName: string
  logoUrl?: string | null
  weeklyCadence: number
  runway: Runway
}

const STATUS_BADGE: Record<RunwayStatus, { label: string; cls: string }> = {
  ok: { label: 'Al día', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  warn: { label: 'Atrasado', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  risk: { label: 'En riesgo', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
  no_cadence: { label: 'Sin cadencia', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
}

function weekColor(weeks: number | null): string {
  if (weeks === null) return 'bg-muted'
  if (weeks >= TARGET_WEEKS) return 'bg-emerald-500'
  if (weeks >= 2) return 'bg-amber-500'
  return 'bg-red-500'
}

/** A single stage's runway: weeks number + a bar filled toward the 1-month target. */
function RunwayBar({ label, weeks }: { label: string; weeks: number | null }) {
  const pct = weeks === null ? 0 : Math.min(100, Math.round((weeks / TARGET_WEEKS) * 100))
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">
          {weeks === null ? '—' : `${weeks} sem`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', weekColor(weeks))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function RunwayRow({ row }: { row: RunwayRowData }) {
  const badge = STATUS_BADGE[row.runway.status]
  return (
    <tr className="group transition-colors hover:bg-muted/40">
      {/* Cliente */}
      <td className="max-w-0 py-2.5 pl-3 pr-3 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <ClientLogo name={row.clientName} logoUrl={row.logoUrl} className="h-7 w-7 text-[9px]" />
          <Link href={`/clients/${row.clientId}`} className="truncate text-sm font-medium hover:text-primary">
            {row.clientName}
          </Link>
        </div>
      </td>
      {/* Cadencia */}
      <td className="whitespace-nowrap py-2.5 pr-3 align-middle text-xs tabular-nums text-muted-foreground">
        {row.weeklyCadence > 0 ? `${row.weeklyCadence}/sem` : '—'}
      </td>
      {/* Runway por etapa */}
      <td className="w-32 py-2.5 pr-3 align-middle"><RunwayBar label="Ideas" weeks={row.runway.ideasWeeks} /></td>
      <td className="w-32 py-2.5 pr-3 align-middle"><RunwayBar label="Grabado" weeks={row.runway.recordedWeeks} /></td>
      <td className="w-32 py-2.5 pr-3 align-middle"><RunwayBar label="Editado" weeks={row.runway.editedWeeks} /></td>
      {/* Estado */}
      <td className="py-2.5 pr-3 text-right align-middle">
        <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap', badge.cls)}>
          {badge.label}
        </span>
      </td>
    </tr>
  )
}
