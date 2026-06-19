import { MapPin } from 'lucide-react'
import { formatCompact } from '@/lib/utils/client-report-core'
import type { Demographics } from '@/lib/utils/demographics-core'

export function AudienceSection({ demo, followers }: { demo: Demographics; followers: number }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">Audiencia</h2>
        {followers > 0 && (
          <span className="text-xs text-zinc-400">
            <span className="font-bold text-zinc-700">{formatCompact(followers)}</span> seguidores
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {/* Gender */}
        {demo.gender.total > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Género</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
              <div className="bg-pink-500" style={{ width: `${demo.gender.femalePct}%` }} />
              <div className="bg-blue-500" style={{ width: `${demo.gender.malePct}%` }} />
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { label: 'Mujeres', pct: demo.gender.femalePct, dot: 'bg-pink-500' },
                { label: 'Hombres', pct: demo.gender.malePct, dot: 'bg-blue-500' },
              ].map((g) => (
                <div key={g.label} className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
                  <span className="flex-1">{g.label}</span>
                  <span className="font-bold tabular-nums text-zinc-900">{g.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Age */}
        {demo.ages.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Edad</p>
            <div className="space-y-2">
              {demo.ages.map((a) => (
                <div key={a.label} className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 text-zinc-500">{a.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${a.pct}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right font-bold tabular-nums text-zinc-900">{a.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top locations */}
        {demo.topCities.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Top ubicaciones</p>
            <div className="space-y-2">
              {demo.topCities.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs text-zinc-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="font-bold tabular-nums text-zinc-900">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
