import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/performance/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { QuickBriefingButton } from '@/components/home/quick-briefing-button'
import { UrgentTaskList } from '@/components/home/urgent-task-list'
import { TeamWorkload } from '@/components/home/team-workload'
import { RecentCompletions } from '@/components/home/recent-completions'
import { GlobalPipelineSection } from '@/components/home/global-pipeline-section'
import { PlanningBanner } from '@/components/home/planning-banner'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'
import { getWeeklyProductionStatus } from '@/lib/utils/weekly-production'
import { WeeklyProductionCard } from '@/components/home/weekly-production-card'
import { WeeklyComplianceCard } from '@/components/home/weekly-compliance-card'
import { getWeeklyComplianceByClient } from '@/lib/utils/weekly-compliance'
import { currentUserHas } from '@/lib/auth/server'
import Link from 'next/link'
import {
  Users,
  Clock,
  AlertTriangle,
  Bell,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Inbox,
  Film,
  Clapperboard,
  CalendarCheck,
  Video,
} from 'lucide-react'
import type { Task } from '@/lib/supabase/types'

export default async function HomePage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { count: activeClients },
    { data: dueTodayTasks },
    { data: overdueTasks },
    { data: blockedTasks },
    { count: activeAlerts },
    { count: pendingRequests },
    { count: pendingVideoReviews },
    { data: myTasks },
    { data: teamTasksRaw },
    { data: recentCompletions },
    { data: currentProfile },
    { count: productionInReview },
    { count: productionPublishingToday },
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, client:clients(id, name)')
      .neq('status', 'completed')
      .gte('due_at', todayStart)
      .lt('due_at', todayEnd)
      .order('priority', { ascending: true })
      .order('due_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, client:clients(id, name)')
      .neq('status', 'completed')
      .not('due_at', 'is', null)
      .lt('due_at', todayStart)
      .order('due_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, client:clients(id, name)')
      .eq('status', 'blocked')
      .order('priority', { ascending: true }),
    supabase.from('alerts').select('id', { count: 'exact', head: true }),
    supabase
      .from('client_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'in_review']),
    supabase
      .from('video_reviews')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'revision_needed']),
    user
      ? supabase
          .from('tasks')
          .select('id, title, status, priority, due_at, client:clients(id, name)')
          .eq('assignee_id', user.id)
          .neq('status', 'completed')
          .order('priority', { ascending: true })
          .order('due_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase.from('tasks').select('assignee_id, status, due_at, assignee:profiles(id, full_name)').neq('status', 'completed').not('assignee_id', 'is', null),
    supabase.from('tasks').select('id, title, updated_at, client:clients(name), assignee:profiles!tasks_assignee_id_fkey(full_name)').eq('status', 'completed').order('updated_at', { ascending: false }).limit(8),
    user ? supabase.from('profiles').select('full_name').eq('id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('production_tasks').select('id', { count: 'exact', head: true }).in('status', ['en_revision', 'revisiones']),
    supabase.from('production_tasks').select('id', { count: 'exact', head: true }).eq('publish_date', now.toISOString().slice(0, 10)).in('status', ['aprobado', 'publicado']),
  ] as const)

  // Count clients with low video buffer (< 6 grabadas)
  const { data: bufferIdeas } = await supabase
    .from('content_ideas')
    .select('client_id')
    .eq('status', 'grabada')

  const bufferMap = new Map<string, number>()
  for (const row of bufferIdeas ?? []) {
    bufferMap.set(row.client_id, (bufferMap.get(row.client_id) ?? 0) + 1)
  }
  // Clients with 0 buffer also count — get active clients
  const { data: activeClientsList } = await supabase.from('clients').select('id').eq('status', 'active')
  let lowBufferCount = 0
  let criticalBufferCount = 0
  for (const c of activeClientsList ?? []) {
    const count = bufferMap.get(c.id) ?? 0
    if (count <= 3) criticalBufferCount++
    else if (count <= 6) lowBufferCount++
  }
  const totalBufferAlert = criticalBufferCount + lowBufferCount

  // Build team workload
  const nowIso2 = now.toISOString()
  type MemberLoad = { id: string; full_name: string | null; pending: number; inProgress: number; overdue: number }
  const memberMap = new Map<string, MemberLoad>()
  for (const t of teamTasksRaw ?? []) {
    const aId = t.assignee_id as string
    const a = (t.assignee as unknown) as { id: string; full_name: string | null } | null
    if (!aId || !a) continue
    if (!memberMap.has(aId)) {
      memberMap.set(aId, { id: aId, full_name: a.full_name, pending: 0, inProgress: 0, overdue: 0 })
    }
    const m = memberMap.get(aId)!
    if (t.status === 'in_progress') m.inProgress++
    else m.pending++
    if (t.due_at && (t.due_at as string) < nowIso2) m.overdue++
  }
  const teamWorkload = Array.from(memberMap.values()).sort((a, b) => (b.inProgress + b.pending) - (a.inProgress + a.pending))

  const greetingHour = now.getHours()
  const greeting = greetingHour < 12 ? 'Buenos días' : greetingHour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = (currentProfile as { full_name?: string | null } | null)?.full_name?.split(' ')[0] ?? null

  const dayName = now.toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' })

  const pipelineGlobal = await getPipelineTotals()
  const weeklyProduction = await getWeeklyProductionStatus()
  const canSeeWeeklyCompliance = await currentUserHas('weekly_compliance.read')
  const weeklyCompliance = canSeeWeeklyCompliance ? await getWeeklyComplianceByClient() : null
  const planning = await getWorkflowProgress().catch(() => ({ rows: [], pendingCount: 0 }))
  const planningBuckets = {
    reagendar: planning.rows.filter((r) => r.status === 'reagendar').length,
    agendar: planning.rows.filter((r) => r.status === 'agendar').length,
    ideas: planning.rows.filter((r) => r.status === 'ideas').length,
    listo: planning.rows.filter((r) => r.status === 'listo').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ', equipo NMedia'} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dayName}</p>
        </div>
        <QuickBriefingButton />
      </div>

      {/* Planning banner — always visible, non-dismissible until everyone is ready */}
      <PlanningBanner
        pendingCount={planning.pendingCount}
        buckets={planningBuckets}
        total={planning.rows.length}
      />

      {/* My Tasks — personal work first, before the global view */}
      {(myTasks?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Mis Tareas
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
                {myTasks?.length ?? 0}
              </span>
            </h2>
            <Link href="/operations?assignee=me" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-primary hover:underline">
              Ver en Operaciones <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <UrgentTaskList
            tasks={(myTasks as unknown as Task[]) ?? []}
            title=""
            emptyMsg=""
            linkHref="/operations"
          />
        </div>
      )}

      {/* Global content pipeline overview */}
      <GlobalPipelineSection totals={pipelineGlobal.totals} perClient={pipelineGlobal.perClient} />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <UrgentTaskList
          tasks={(overdueTasks as unknown as Task[]) ?? []}
          title={`Tareas Vencidas ${overdueTasks?.length ? `(${overdueTasks.length})` : ''}`}
          emptyMsg="Sin tareas vencidas ✓"
          linkHref="/operations"
        />
        <UrgentTaskList
          tasks={(dueTodayTasks as unknown as Task[]) ?? []}
          title={`Vence Hoy ${dueTodayTasks?.length ? `(${dueTodayTasks.length})` : ''}`}
          emptyMsg="Sin deadlines hoy"
          linkHref="/operations"
        />
        <UrgentTaskList
          tasks={(blockedTasks as unknown as Task[]) ?? []}
          title={`Bloqueadas ${blockedTasks?.length ? `(${blockedTasks.length})` : ''}`}
          emptyMsg="Sin tareas bloqueadas ✓"
          linkHref="/operations"
        />
      </div>

      {/* Weekly production readiness — recorded / edited / captioned */}
      <WeeklyProductionCard status={weeklyProduction} />

      {/* Weekly posting compliance per client (live) — quota vs published */}
      {weeklyCompliance && <WeeklyComplianceCard data={weeklyCompliance} />}

      {/* Team workload */}
      <TeamWorkload members={teamWorkload} />

      {/* Completions */}
      <RecentCompletions completions={(recentCompletions ?? []) as unknown as Parameters<typeof RecentCompletions>[0]['completions']} />

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
        {[
          { href: '/operations', label: 'Operaciones', sub: 'Ver todas las tareas', color: 'bg-blue-500/10 text-blue-500' },
          { href: '/published', label: 'Publicados', sub: 'Ver todo el contenido', color: 'bg-green-500/10 text-green-500' },
          { href: '/clients', label: 'Clientes', sub: `${activeClients ?? 0} clientes activos`, color: 'bg-orange-500/10 text-orange-500' },
          { href: '/video-reviews', label: 'Video QC', sub: `${pendingVideoReviews ?? 0} pendientes`, color: 'bg-cyan-500/10 text-cyan-500' },
          { href: '/team', label: 'Equipo', sub: 'Tareas por miembro', color: 'bg-violet-500/10 text-violet-500' },
          { href: '/recording-calendar', label: 'Grabaciones', sub: `${totalBufferAlert > 0 ? `${totalBufferAlert} cliente${totalBufferAlert !== 1 ? 's' : ''} buffer bajo` : 'Calendario de sesiones'}`, color: 'bg-rose-500/10 text-rose-500' },
          { href: '/produccion', label: 'Producción', sub: `${productionInReview ?? 0} en revisión`, color: 'bg-yellow-500/10 text-yellow-600' },
        ].map(({ href, label, sub, color }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <div className={`inline-flex items-center justify-center rounded-lg p-2 mb-2 ${color}`}>
                  <ArrowRight className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
