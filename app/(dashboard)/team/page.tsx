import { createClient } from '@/lib/supabase/server'
import { TeamOverview } from '@/components/team/team-overview'
import type { Task, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()

  const nowIso = new Date().toISOString()

  const [{ data: profiles }, { data: allTasks }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, avatar_url').order('full_name'),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, type, assignee_id, client:clients(id, name)')
      .neq('status', 'completed')
      .not('assignee_id', 'is', null)
      .order('priority', { ascending: true })
      .order('due_at', { ascending: true }),
  ])

  // Build per-member task lists
  const memberTasks: Record<string, Task[]> = {}
  for (const t of allTasks ?? []) {
    if (!t.assignee_id) continue
    if (!memberTasks[t.assignee_id]) memberTasks[t.assignee_id] = []
    memberTasks[t.assignee_id].push(t as unknown as Task)
  }

  const members = (profiles ?? []).map((p) => ({
    ...p,
    tasks: memberTasks[p.id] ?? [],
    overdue: (memberTasks[p.id] ?? []).filter((t) => t.due_at && t.due_at < nowIso).length,
  })).sort((a, b) => b.tasks.length - a.tasks.length)

  return (
    <TeamOverview members={members as (Profile & { tasks: Task[]; overdue: number })[]} />
  )
}
