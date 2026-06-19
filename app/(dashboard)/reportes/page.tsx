import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getClientReport } from '@/lib/actions/client-report'
import { getAgencyReport } from '@/lib/actions/agency-report'
import { getReportInsights } from '@/lib/actions/report-insights'
import { deltaPct } from '@/lib/utils/report-delta-core'
import { topContentType, topPosts, type InsightFacts } from '@/lib/utils/report-insights-core'
import { ReportSelector } from '@/components/reportes/report-selector'
import { ClientReportDocument } from '@/components/reportes/client-report-document'
import { AgencyReportDocument } from '@/components/reportes/agency-report-document'
import { PrintButton } from '@/components/clients/report/print-button'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; clientId?: string; days?: string }>
}) {
  await requirePermission('metricool.read')
  const sp = await searchParams
  const type: 'cliente' | 'agencia' = sp.type === 'agencia' ? 'agencia' : 'cliente'
  const days = Number(sp.days) || 30
  const clientId = sp.clientId ?? ''

  const supabase = await createClient()
  const { data } = await supabase.from('clients').select('id, name').order('name')
  const clients = (data ?? []) as { id: string; name: string }[]

  let body: React.ReactNode
  if (type === 'agencia') {
    body = <AgencyReportDocument report={await getAgencyReport(days)} />
  } else if (clientId) {
    const report = await getClientReport(clientId, days, { compare: true })
    if (report) {
      let insights = ''
      if (report.metricoolConfigured && report.posts.length > 0) {
        const best = topPosts(report.posts, 1)[0]
        const facts: InsightFacts = {
          clientName: report.client.name,
          periodDays: report.periodDays,
          reach: report.summary.reach,
          reachDeltaPct: report.previousSummary ? deltaPct(report.summary.reach, report.previousSummary.reach) : null,
          impressions: report.summary.impressions,
          engagement: report.summary.engagement,
          posts: report.summary.posts,
          igPosts: report.summary.byNetwork.instagram,
          fbPosts: report.summary.byNetwork.facebook,
          topContentType: topContentType(report.posts),
          bestPostReach: best?.reach ?? 0,
          bestPostExcerpt: (best?.content ?? '').slice(0, 120),
        }
        insights = await getReportInsights(facts)
      }
      body = <ClientReportDocument report={report} insights={insights} />
    } else {
      body = (
        <p className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No encontramos ese cliente.
        </p>
      )
    }
  } else {
    body = (
      <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
        Elige un cliente arriba para generar su reporte de desempeño.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Genera reportes profesionales: el desempeño de un cliente (con comparación vs el período anterior) o un
          resumen de toda la agencia.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ReportSelector type={type} clientId={clientId} days={days} clients={clients} />
        <PrintButton />
      </div>

      {body}
    </div>
  )
}
