import { createClient } from '@/lib/supabase/server'
import type { ClientStatus } from '@/lib/supabase/types'

export interface ClientEfficiencyRow {
  id: string
  name: string
  status: ClientStatus
  assigneeName: string | null
  openTasks: number
  overdueTasks: number
  completedTasks30d: number
  postsPublished30d: number
  postsScheduledNext7d: number
  daysSinceLastPost: number | null
  score: number
}

const DAY = 24 * 60 * 60 * 1000

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computeScore(
  overdue: number,
  completed30d: number,
  posts30d: number,
): number {
  const onTime = clamp(100 - overdue * 25, 0, 100)
  const throughput = clamp(completed30d * 10, 0, 100)
  const posting = clamp(posts30d * 5, 0, 100)
  return Math.round((onTime + throughput + posting) / 3)
}

export async function getClientEfficiency(): Promise<ClientEfficiencyRow[]> {
  const supabase = await createClient()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY).toISOString()
  const sevenDaysAhead = new Date(now.getTime() + 7 * DAY).toISOString()
  const nowIso = now.toISOString()

  const [{ data: clients }, { data: tasks }, { data: events }] =
    await Promise.all([
      supabase
        .from('clients')
        .select('id, name, status, assignee:profiles!clients_assigned_to_fkey(full_name)')
        .order('name'),
      supabase
        .from('tasks')
        .select('client_id, status, due_at, updated_at')
        .not('client_id', 'is', null),
      supabase
        .from('content_events')
        .select('client_id, status, scheduled_at')
        .not('client_id', 'is', null),
    ])

  if (!clients) return []

  return clients.map((c) => {
    const clientTasks = (tasks ?? []).filter((t) => t.client_id === c.id)
    const clientEvents = (events ?? []).filter((e) => e.client_id === c.id)

    const openTasks = clientTasks.filter(
      (t) => t.status !== 'completed',
    ).length
    const overdueTasks = clientTasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.due_at != null &&
        t.due_at < nowIso,
    ).length
    const completedTasks30d = clientTasks.filter(
      (t) => t.status === 'completed' && t.updated_at >= thirtyDaysAgo,
    ).length

    const publishedEvents = clientEvents.filter(
      (e) => e.status === 'published',
    )
    const postsPublished30d = publishedEvents.filter(
      (e) => e.scheduled_at >= thirtyDaysAgo && e.scheduled_at <= nowIso,
    ).length
    const postsScheduledNext7d = clientEvents.filter(
      (e) =>
        e.status === 'scheduled' &&
        e.scheduled_at >= nowIso &&
        e.scheduled_at <= sevenDaysAhead,
    ).length

    const lastPost = publishedEvents
      .map((e) => e.scheduled_at)
      .filter((d) => d <= nowIso)
      .sort()
      .pop()
    const daysSinceLastPost = lastPost
      ? Math.floor((now.getTime() - new Date(lastPost).getTime()) / DAY)
      : null

    const assigneeRel = (c as { assignee?: { full_name: string | null } | { full_name: string | null }[] | null }).assignee
    const assigneeName = Array.isArray(assigneeRel)
      ? assigneeRel[0]?.full_name ?? null
      : assigneeRel?.full_name ?? null

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      assigneeName,
      openTasks,
      overdueTasks,
      completedTasks30d,
      postsPublished30d,
      postsScheduledNext7d,
      daysSinceLastPost,
      score: computeScore(overdueTasks, completedTasks30d, postsPublished30d),
    }
  })
}
