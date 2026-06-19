import {
  Image as ImageIcon,
  Eye,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Users,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'
import { formatCompact, type ReportPost } from '@/lib/utils/client-report-core'
import { deltaPct, deltaTone, formatDelta } from '@/lib/utils/report-delta-core'
import type { ClientReport } from '@/lib/actions/client-report'
import { cn } from '@/lib/utils'

function fmtDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtRange(start: string, end: string): string {
  const p = (s: string) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  return `${p(start)} – ${p(end)}`
}

export function ClientReportDocument({ report }: { report: ClientReport }) {
  const { client, summary, posts, previousSummary, metricoolConfigured } = report
  const prev = previousSummary
  const kpis = [
    { label: 'Personas alcanzadas', value: summary.reach, prev: prev?.reach, icon: Users },
    { label: 'Impresiones', value: summary.impressions, prev: prev?.impressions, icon: BarChart3 },
    { label: 'Interacciones', value: summary.engagement, prev: prev?.engagement, icon: Heart },
    { label: 'Publicaciones', value: summary.posts, prev: prev?.posts, icon: TrendingUp },
  ]

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 text-zinc-900 shadow-sm print:border-0 print:shadow-none sm:p-10">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logoUrl} alt={client.name} className="h-14 w-14 rounded-xl object-cover" />
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
          <section className="grid grid-cols-2 gap-3 py-6 md:grid-cols-4">
            {kpis.map((k) => {
              const d = prev != null ? deltaPct(k.value, k.prev) : null
              const tone = deltaTone(d)
              return (
                <div key={k.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-zinc-400">
                    <k.icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCompact(k.value)}</p>
                    {prev != null && (
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
          {prev != null && (
            <p className="-mt-3 mb-3 text-xs text-zinc-400">▲▼ comparado con el período anterior de igual duración.</p>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Publicaciones ({posts.length})</h2>
            <span className="text-xs text-zinc-400">
              {summary.byNetwork.instagram} Instagram · {summary.byNetwork.facebook} Facebook
            </span>
          </div>

          {posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No hubo publicaciones en este período.</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p, i) => (
                <PostRow key={`${p.network}-${p.timestamp}-${i}`} post={p} top={i === summary.topPostIndex} />
              ))}
            </ul>
          )}
        </>
      )}

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-400">
        Generado por Nate Media · Datos de Metricool · {fmtRange(report.start, report.end)}
      </footer>
    </div>
  )
}

function PostRow({ post, top }: { post: ReportPost; top: boolean }) {
  const net =
    post.network === 'instagram'
      ? { label: 'IG', cls: 'bg-pink-100 text-pink-600' }
      : { label: 'FB', cls: 'bg-blue-100 text-blue-600' }
  const metrics: { icon: typeof Eye; value: number; label: string }[] = [
    { icon: Users, value: post.reach, label: 'alcance' },
    { icon: BarChart3, value: post.impressions, label: 'impresiones' },
    { icon: Heart, value: post.likes, label: 'me gusta' },
    { icon: MessageCircle, value: post.comments, label: 'comentarios' },
    { icon: Share2, value: post.shares, label: 'compartidos' },
    { icon: Bookmark, value: post.saved, label: 'guardados' },
    { icon: Eye, value: post.views, label: 'reproducciones' },
  ].filter((m) => m.value > 0)

  return (
    <li className={cn('flex gap-4 rounded-xl border p-3', top ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white')}>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-zinc-300">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <span className={cn('absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-bold leading-none shadow-sm', net.cls)}>
          {net.label}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {post.type}
          </span>
          {top && (
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Top alcance
            </span>
          )}
          <span className="text-xs text-zinc-400">{fmtDate(post.timestamp)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{post.content || '(sin texto)'}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {metrics.map((m) => (
            <span key={m.label} className="inline-flex items-center gap-1 text-xs text-zinc-600" title={m.label}>
              <m.icon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-semibold tabular-nums">{formatCompact(m.value)}</span>
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}
