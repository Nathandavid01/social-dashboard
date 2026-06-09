'use client'

import { useState, useTransition } from 'react'
import { Film, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVideoUploadMetricsByUser } from '@/lib/actions/video-uploads'
import { editedRatioPct, uploadStaleness, type NamedUserUploadCounts } from '@/lib/utils/video-upload-metrics'
import { startOfRangeISO, type DateRange } from '@/lib/utils/date-ranges'

const RANGES: { key: DateRange; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'month', label: 'Este mes' },
  { key: 'week', label: 'Esta semana' },
]

/**
 * Per-member upload history: counts by kind + edited ratio + last-upload
 * staleness, with time-range presets that refetch via the (team.read-gated)
 * server action. Initial "all-time" counts come from the server page.
 */
export function MemberUploadHistory({
  userId,
  initial,
}: {
  userId: string
  initial: NamedUserUploadCounts | null
}) {
  const [range, setRange] = useState<DateRange>('all')
  const [counts, setCounts] = useState<NamedUserUploadCounts | null>(initial)
  const [pending, startTransition] = useTransition()

  function pick(r: DateRange) {
    setRange(r)
    startTransition(async () => {
      const since = startOfRangeISO(r) ?? undefined
      const rows = await getVideoUploadMetricsByUser({ userId, since })
      setCounts(rows[0] ?? null)
    })
  }

  const total = counts?.total ?? 0
  const ratio = counts ? editedRatioPct(counts) : null
  const stale = counts ? uploadStaleness(counts.lastUploadAt) : null

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Videos subidos</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{total}</span>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => pick(r.key)}
              disabled={pending}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50',
                range === r.key ? 'border-border bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/60',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('rounded-lg border bg-card px-4 py-3 transition-opacity', pending && 'opacity-60')}>
        {total === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Sin subidas en este rango.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Stat label="Raw" value={counts!.raw} />
            <Stat label="B-roll" value={counts!.broll} />
            <Stat label="Editados" value={counts!.edited} />
            {ratio !== null && <Stat label="Editado" value={`${ratio}%`} muted />}
            {stale && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden />
                {stale.days === 0 ? 'subió hoy' : `última subida hace ${stale.days}d`}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, muted }: { label: string; value: number | string; muted?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', muted ? 'text-muted-foreground' : 'text-foreground')}>{value}</span>
    </div>
  )
}
