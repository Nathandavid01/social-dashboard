import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Image as ImageIcon,
  Eye,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Users,
  TrendingUp,
} from 'lucide-react'
import { getClientReport } from '@/lib/actions/client-report'
import { formatCompact, type ReportPost } from '@/lib/utils/client-report-core'
import { PrintButton } from '@/components/clients/report/print-button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

function fmtDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtRange(start: string, end: string): string {
  const p = (s: string) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  return `${p(start)} – ${p(end)}`
}

export default async function ClientReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ days?: string }>
}) {
  const { id } = await params
  const { days: daysParam } = await searchParams
  const days = Number(daysParam) || 30
  const report = await getClientReport(id, days)
  if (!report) notFound()

  const { client, summary, posts, metricoolConfigured } = report
  const kpis = [
    { label: 'Personas alcanzadas', value: summary.reach, icon: Users },
    { label: 'Impresiones', value: summary.impressions, icon: BarChart3 },
    { label: 'Interacciones', value: summary.engagement, icon: Heart },
    { label: 'Publicaciones', value: summary.posts, icon: TrendingUp },
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al cliente
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {PERIODS.map((p) => (
              <Link
                key={p.days}
                href={`/clients/${client.id}/reporte?days=${p.days}`}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  report.periodDays === p.days
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {/* The report document — a clean light sheet that prints well */}
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
            {/* KPI row */}
            <section className="grid grid-cols-2 gap-3 py-6 md:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-zinc-400">
                    <k.icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
                  </div>
                  <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCompact(k.value)}</p>
                </div>
              ))}
            </section>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                Publicaciones ({posts.length})
              </h2>
              <span className="text-xs text-zinc-400">
                {summary.byNetwork.instagram} Instagram · {summary.byNetwork.facebook} Facebook
              </span>
            </div>

            {posts.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                No hubo publicaciones en este período.
              </p>
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
    <li
      className={cn(
        'flex gap-4 rounded-xl border p-3',
        top ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white',
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-zinc-300">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <span
          className={cn(
            'absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-bold leading-none shadow-sm',
            net.cls,
          )}
        >
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
