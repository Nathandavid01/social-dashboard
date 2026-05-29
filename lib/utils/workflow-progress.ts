import { createClient } from '@/lib/supabase/server'
import type {
  ClientWorkflowProgress,
  WorkflowSettings,
  WorkflowStepStatus,
} from './workflow-types'

export type { ClientWorkflowProgress, WorkflowSettings, WorkflowStepStatus }
export { STATUS_META } from './workflow-types'

const DEFAULT_SETTINGS: WorkflowSettings = {
  weekly_planning_enabled: true,
  scheduling_window_days: 7,
  min_ideas_per_session: 4,
  ideas_multiplier: 2,
  require_rescheduling: true,
  steps: [
    { slug: 'scheduled',   name: 'Agendar próxima sesión',     required: true },
    { slug: 'ideas',       name: 'Tener ideas listas',         required: true },
    { slug: 'rescheduled', name: 'Reagendar después de grabar', required: true },
  ],
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflow_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()
  if (error || !data) return DEFAULT_SETTINGS
  return {
    weekly_planning_enabled: data.weekly_planning_enabled ?? true,
    scheduling_window_days: data.scheduling_window_days ?? 7,
    min_ideas_per_session: data.min_ideas_per_session ?? 4,
    ideas_multiplier: Number(data.ideas_multiplier ?? 2),
    require_rescheduling: data.require_rescheduling ?? true,
    steps: Array.isArray(data.steps) ? data.steps : DEFAULT_SETTINGS.steps,
  }
}

function todayIsoDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface SessionRow {
  id: string
  session_date: string
  status: string
  client_id: string | null
}
interface IdeaRow {
  client_id: string | null
  status: string
}
interface ClientRow {
  id: string
  name: string
  posting_days: number[] | null
}

export async function getWorkflowProgress(): Promise<{
  settings: WorkflowSettings
  rows: ClientWorkflowProgress[]
  pendingCount: number
}> {
  const supabase = await createClient()
  const settings = await getWorkflowSettings()
  const today = todayIsoDate()

  const [{ data: clients }, { data: sessions }, { data: ideas }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, posting_days')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('recording_sessions')
      .select('id, session_date, status, client_id')
      .not('client_id', 'is', null)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true }),
    supabase
      .from('content_ideas')
      .select('client_id, status')
      .in('status', ['idea', 'asignada']),
  ])

  const sessionRows = (sessions ?? []) as SessionRow[]
  const ideaRows = (ideas ?? []) as IdeaRow[]

  const sessionsByClient = new Map<string, SessionRow[]>()
  for (const s of sessionRows) {
    if (!s.client_id) continue
    const arr = sessionsByClient.get(s.client_id) ?? []
    arr.push(s)
    sessionsByClient.set(s.client_id, arr)
  }

  const ideasByClient = new Map<string, number>()
  for (const i of ideaRows) {
    if (!i.client_id) continue
    ideasByClient.set(i.client_id, (ideasByClient.get(i.client_id) ?? 0) + 1)
  }

  const rows: ClientWorkflowProgress[] = []
  for (const c of (clients ?? []) as ClientRow[]) {
    const sessions = sessionsByClient.get(c.id) ?? []
    const future = sessions.filter((s) => s.session_date >= today)
    const past = sessions.filter((s) => s.session_date < today)
    const hasUpcomingSession = future.length > 0
    const nextSessionAt = hasUpcomingSession ? future[0].session_date : null
    const lastSessionAt = past.length > 0 ? past[past.length - 1].session_date : null

    const postingDays = c.posting_days ?? []
    const ideaCount = ideasByClient.get(c.id) ?? 0
    // Ideation is the first step: keep at least a month (4 weeks of cadence) of
    // ideas ready ahead of time, with a hard floor for clients without cadence.
    const ideasTarget = Math.max(settings.min_ideas_per_session, postingDays.length * 4)

    const needsRescheduling = settings.require_rescheduling && !hasUpcomingSession && !!lastSessionAt

    // Order matters: ideación always comes first, then scheduling/rescheduling.
    let status: WorkflowStepStatus
    if (ideaCount < ideasTarget) status = 'ideas'
    else if (needsRescheduling) status = 'reagendar'
    else if (!hasUpcomingSession) status = 'agendar'
    else status = 'listo'

    rows.push({
      clientId: c.id,
      clientName: c.name,
      postingDays,
      status,
      hasUpcomingSession,
      nextSessionAt,
      lastSessionAt,
      ideaCount,
      ideasTarget,
      needsRescheduling,
    })
  }

  // Sort by workflow order: ideación first, then rescheduling, then scheduling, then listo
  const order: Record<WorkflowStepStatus, number> = { ideas: 0, reagendar: 1, agendar: 2, listo: 3 }
  rows.sort((a, b) => order[a.status] - order[b.status] || a.clientName.localeCompare(b.clientName))

  const pendingCount = rows.filter((r) => r.status !== 'listo').length

  return { settings, rows, pendingCount }
}

