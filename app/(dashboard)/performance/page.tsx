import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/performance/kpi-card'
import { EngagementChart } from '@/components/performance/engagement-chart'
import { PlatformBreakdown } from '@/components/performance/platform-breakdown'
import { Users, CalendarCheck, AlertCircle, Clock } from 'lucide-react'
import { startOfWeek, endOfWeek } from 'date-fns'

export default async function PerformancePage() {
  const supabase = await createClient()

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  const [
    { count: totalActive },
    { count: postsThisWeek },
    { count: pendingApprovals },
    { count: alertCount },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('content_events')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', weekStart.toISOString())
      .lte('scheduled_at', weekEnd.toISOString()),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('type', 'review'),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Agency KPIs and engagement overview"
      />

      {/* KPI Bar */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Clients"
          value={totalActive ?? 0}
          icon={Users}
          description="Currently active"
        />
        <KpiCard
          label="Posts This Week"
          value={postsThisWeek ?? 0}
          icon={CalendarCheck}
          description="Scheduled for this week"
          highlight="success"
        />
        <KpiCard
          label="Pending Reviews"
          value={pendingApprovals ?? 0}
          icon={Clock}
          description="Awaiting approval"
          highlight="warning"
        />
        <KpiCard
          label="Active Alerts"
          value={alertCount ?? 0}
          icon={AlertCircle}
          description="Require attention"
          highlight={alertCount && alertCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EngagementChart />
        </div>
        <div>
          <PlatformBreakdown />
        </div>
      </div>
    </div>
  )
}
