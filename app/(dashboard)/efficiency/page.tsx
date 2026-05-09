import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/performance/kpi-card'
import { EfficiencyTable } from '@/components/efficiency/efficiency-table'
import { getClientEfficiency } from '@/lib/actions/efficiency'
import { Gauge, AlertTriangle, TrendingUp, Clock } from 'lucide-react'

export default async function EfficiencyPage() {
  const rows = await getClientEfficiency()
  const active = rows.filter((r) => r.status === 'active')

  const avgScore = active.length
    ? Math.round(active.reduce((s, r) => s + r.score, 0) / active.length)
    : 0
  const needsAttention = active.filter((r) => r.score < 60).length
  const overdueClients = active.filter((r) => r.overdueTasks > 0).length
  const stale = active.filter(
    (r) => r.daysSinceLastPost != null && r.daysSinceLastPost > 14,
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Efficiency"
        description="Workflow health by client — score blends overdue tasks, throughput, and posting cadence"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Avg Score"
          value={avgScore}
          icon={Gauge}
          description={`${active.length} active clients`}
          highlight={avgScore >= 80 ? 'success' : avgScore >= 60 ? 'warning' : 'danger'}
        />
        <KpiCard
          label="Needs Attention"
          value={needsAttention}
          icon={AlertTriangle}
          description="Score below 60"
          highlight={needsAttention > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Clients with Overdue"
          value={overdueClients}
          icon={Clock}
          description="At least one overdue task"
          highlight={overdueClients > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Stale (14d+)"
          value={stale}
          icon={TrendingUp}
          description="No recent published post"
          highlight={stale > 0 ? 'warning' : 'default'}
        />
      </div>

      <EfficiencyTable rows={rows} />
    </div>
  )
}
