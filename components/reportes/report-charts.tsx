import { formatCompact } from '@/lib/utils/client-report-core'
import type { ReachBucket } from '@/lib/utils/report-insights-core'
import { InstagramIcon, FacebookIcon } from './network-icons'

/** Weekly reach bar chart — pure CSS, prints cleanly. */
export function WeeklyReachChart({ data }: { data: ReachBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.reach))
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Alcance en el tiempo</p>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-zinc-400">
              {d.reach > 0 ? formatCompact(d.reach) : ''}
            </span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-amber-400 to-amber-300"
              style={{ height: `${Math.max(2, Math.round((d.reach / max) * 100))}%` }}
            />
            <span className="text-[9px] text-zinc-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Reach split Instagram vs Facebook. */
export function NetworkSplitBar({ instagram, facebook }: { instagram: number; facebook: number }) {
  const total = instagram + facebook
  const igPct = total > 0 ? Math.round((instagram / total) * 100) : 0
  const fbPct = total > 0 ? 100 - igPct : 0
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Alcance por red</p>
      {total === 0 ? (
        <p className="text-sm text-zinc-400">Sin datos.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
            <div className="bg-pink-500" style={{ width: `${igPct}%` }} />
            <div className="bg-blue-500" style={{ width: `${fbPct}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-zinc-600">
              <InstagramIcon size={14} /> Instagram
              <span className="font-bold tabular-nums">{igPct}%</span>
              <span className="text-zinc-400">({formatCompact(instagram)})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-zinc-600">
              <FacebookIcon size={14} /> Facebook
              <span className="font-bold tabular-nums">{fbPct}%</span>
              <span className="text-zinc-400">({formatCompact(facebook)})</span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
