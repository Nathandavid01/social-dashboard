import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/performance/kpi-card'
import { EngagementChart } from '@/components/performance/engagement-chart'
import { PlatformBreakdown } from '@/components/performance/platform-breakdown'
import { Users, CheckCircle2, AlertCircle, ShieldAlert, Clock } from 'lucide-react'
import { startOfWeek, endOfWeek } from 'date-fns'

export default async function PerformancePage() {
  const supabase = await createClient()

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  const now = new Date()

  const [
    { count: totalActive },
    { count: completedThisWeek },
    { count: alertCount },
    { count: blockedTasks },
    { count: overdueTasks },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', weekStart.toISOString())
      .lte('updated_at', weekEnd.toISOString()),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'blocked'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'completed')
      .not('due_at', 'is', null)
      .lt('due_at', now.toISOString()),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Agency KPIs and engagement overview"
      />

      {/* KPI Bar */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Clientes Activos"
          value={totalActive ?? 0}
          icon={Users}
          description="En operación activa"
        />
        <KpiCard
          label="Tasks esta semana"
          value={completedThisWeek ?? 0}
          icon={CheckCircle2}
          description="Completadas esta semana"
          highlight="success"
        />
        <KpiCard
          label="Tasks Vencidas"
          value={overdueTasks ?? 0}
          icon={Clock}
          description="Pasaron la fecha límite"
          highlight={(overdueTasks ?? 0) > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Tasks Bloqueadas"
          value={blockedTasks ?? 0}
          icon={ShieldAlert}
          description="Necesitan atención"
          highlight={(blockedTasks ?? 0) > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Alertas Activas"
          value={alertCount ?? 0}
          icon={AlertCircle}
          description="Requieren atención"
          highlight={alertCount && alertCount > 0 ? 'warning' : 'default'}
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
