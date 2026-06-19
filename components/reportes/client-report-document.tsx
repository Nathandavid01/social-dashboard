import {
  Image as ImageIcon,
  Heart,
  BarChart3,
  Users,
  UserPlus,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { formatCompact, type ReportPost } from '@/lib/utils/client-report-core'
import { deltaPct, deltaTone, formatDelta } from '@/lib/utils/report-delta-core'
import { reachByNetwork, reachTimeline, topPosts } from '@/lib/utils/report-insights-core'
import type { ClientReport } from '@/lib/actions/client-report'
import { WeeklyReachChart, NetworkSplitBar } from './report-charts'
import { NetworkIcon } from './network-icons'
import { AudienceSection } from './audience-section'
import { ActionPlanSection } from './action-plan-section'
import { cn } from '@/lib/utils'

function fmtRange(start: string, end: string): string {
  const p = (s: string) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  return `${p(start)} – ${p(end)}`
}

/** Route external images through our same-origin proxy so the PDF capture can read them. */
function proxied(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? `/api/img-proxy?u=${encodeURIComponent(url)}` : url
}

function renderInsight(text: string) {
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para, i) => (
      <p key={i} className="text-sm leading-relaxed text-zinc-700">
        {para.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
          seg.startsWith('**') && seg.endsWith('**') ? (
            <strong key={j} className="font-bold text-zinc-900">
              {seg.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{seg}</span>
          ),
        )}
      </p>
    ))
}

export function ClientReportDocument({ report, insights }: { report: ClientReport; insights: string }) {
  const { client, summary, posts, previousSummary, metricoolConfigured } = report
  const prev = previousSummary
  const kpis: { label: string; value: number; prev: number | undefined; icon: LucideIcon }[] = [
    { label: 'Personas alcanzadas', value: summary.reach, prev: prev?.reach, icon: Users },
    { label: 'Impresiones', value: summary.impressions, prev: prev?.impressions, icon: BarChart3 },
    { label: 'Interacciones', value: summary.engagement, prev: prev?.engagement, icon: Heart },
    { label: 'Publicaciones', value: summary.posts, prev: prev?.posts, icon: TrendingUp },
  ]
  if (report.followers > 0) {
    kpis.push({ label: 'Seguidores', value: report.followers, prev: undefined, icon: UserPlus })
  }
  const kpiCols = kpis.length >= 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'
  const net = reachByNetwork(posts)
  const timeline = reachTimeline(posts, report.periodDays, Date.now())
  const featured = topPosts(posts, 3)

  return (
    <div id="report-document" className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 text-zinc-900 shadow-sm print:border-0 print:shadow-none sm:p-10">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxied(client.logoUrl)} alt={client.name} className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-zinc-100 text-lg font-bold text-zinc-400">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Reporte de desempeño</p>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-sm text-zinc-500">{fmtRange(report.start, report.end)}</p>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-lg font-extrabold tracking-tight">
            Nate <span className="text-amber-500">Media</span>
          </p>
          <p className="text-xs text-zinc-400">Operaciones de contenido</p>
        </div>
      </header>

      {!metricoolConfigured ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          Este cliente todavía no tiene Metricool conectado, así que aún no hay métricas que reportar.
        </p>
      ) : (
        <>
          {/* KPIs with period-over-period deltas */}
          <section className={cn('grid grid-cols-2 gap-3 py-6', kpiCols)}>
            {kpis.map((k) => {
              const hasPrev = prev != null && k.prev != null
              const d = hasPrev ? deltaPct(k.value, k.prev) : null
              const tone = deltaTone(d)
              return (
                <div key={k.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-zinc-400">
                    <k.icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCompact(k.value)}</p>
                    {hasPrev && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-semibold',
                          tone === 'up' && 'text-emerald-600',
                          tone === 'down' && 'text-red-600',
                          (tone === 'flat' || tone === 'none') && 'text-zinc-400',
                        )}
                        title="vs período anterior"
                      >
                        {tone === 'up' && <ArrowUp className="h-3 w-3" />}
                        {tone === 'down' && <ArrowDown className="h-3 w-3" />}
                        {(tone === 'flat' || tone === 'none') && <Minus className="h-3 w-3" />}
                        {formatDelta(d)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </section>

          {/* AI executive summary */}
          {insights.trim() && (
            <section className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">Resumen del estratega</h2>
              </div>
              <div className="space-y-2">{renderInsight(insights)}</div>
            </section>
          )}

          {/* Graphics */}
          <section className="mb-6 grid gap-3 md:grid-cols-2">
            <WeeklyReachChart data={timeline} />
            <NetworkSplitBar instagram={net.instagram} facebook={net.facebook} />
          </section>

          {/* Audience (real Metricool demographics) */}
          {report.demographics && <AudienceSection demo={report.demographics} followers={report.followers} />}

          {/* Featured posts */}
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            <Trophy className="h-4 w-4 text-amber-500" /> Publicaciones destacadas
          </h2>
          {featured.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No hubo publicaciones en este período.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {featured.map((p, i) => (
                <FeaturedPost key={`${p.network}-${p.timestamp}-${i}`} post={p} rank={i + 1} />
              ))}
            </div>
          )}

          {/* Action plan — concrete, data-backed recommendations */}
          {report.recommendations.length > 0 && (
            <div className="mt-6">
              <ActionPlanSection
                recommendations={report.recommendations}
                clientName={client.name}
                clientId={client.id}
              />
            </div>
          )}
        </>
      )}

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-400">
        Generado por Nate Media · Datos de Metricool · {fmtRange(report.start, report.end)}
      </footer>
    </div>
  )
}

function FeaturedPost({ post, rank }: { post: ReportPost; rank: number }) {
  const metrics = [
    { label: 'Alcance', value: post.reach },
    { label: 'Interacciones', value: post.engagement },
    { label: 'Me gusta', value: post.likes },
  ].filter((m) => m.value > 0)

  return (
    <div className={cn('overflow-hidden rounded-xl border', rank === 1 ? 'border-amber-300' : 'border-zinc-200')}>
      <div className="relative aspect-square w-full bg-zinc-100">
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxied(post.thumbnail)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-zinc-300">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 shadow-sm">
          <NetworkIcon network={post.network} size={12} /> {post.type}
        </span>
        {rank === 1 && (
          <span className="absolute right-2 top-2 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-sm">
            #1
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-xs text-zinc-600">{post.content || '(sin texto)'}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {metrics.map((m) => (
            <div key={m.label} className="text-[11px]">
              <span className="font-bold tabular-nums text-zinc-900">{formatCompact(m.value)}</span>{' '}
              <span className="text-zinc-400">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
