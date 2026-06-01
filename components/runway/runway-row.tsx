import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ClientLogo } from '@/components/clients/client-logo'
import { RunwayBar } from './runway-bar'
import type { Runway, RunwayStatus } from '@/lib/utils/content-runway'

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
