import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { RoleGate } from '@/components/auth/role-gate'
import { TeamOverview } from '@/components/team/team-overview'
import { UserAdminTable } from '@/components/team/user-admin-table'
import { getVideoUploadMetricsByUser } from '@/lib/actions/video-uploads'
import type { Task, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  await requirePermission('team.read')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const nowIso = new Date().toISOString()

  const [{ data: profiles }, { data: allTasks }, uploadMetrics] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, status, title, avatar_url').order('full_name'),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_at, type, assignee_id, client:clients(id, name)')
      .neq('status', 'completed')
      .not('assignee_id', 'is', null)
      .order('priority', { ascending: true })
      .order('due_at', { ascending: true }),
    getVideoUploadMetricsByUser(),
  ])

  // Build per-member task lists
  const memberTasks: Record<string, Task[]> = {}
  for (const t of allTasks ?? []) {
    if (!t.assignee_id) continue
    if (!memberTasks[t.assignee_id]) memberTasks[t.assignee_id] = []
    memberTasks[t.assignee_id].push(t as unknown as Task)
  }

  // Per-member video upload counts (raw / b-roll / edited).
  const uploadsByUser = new Map(uploadMetrics.map((u) => [u.userId, u]))

  const members = (profiles ?? []).map((p) => {
    const u = uploadsByUser.get(p.id)
    return {
      ...p,
      tasks: memberTasks[p.id] ?? [],
      overdue: (memberTasks[p.id] ?? []).filter((t) => t.due_at && t.due_at < nowIso).length,
      uploads: u ? { raw: u.raw, broll: u.broll, edited: u.edited, total: u.total } : undefined,
    }
  }).sort((a, b) => b.tasks.length - a.tasks.length)

  return (
    <div className="space-y-6">
      <RoleGate perm="team.assign_roles">
        <UserAdminTable users={(profiles ?? []) as Profile[]} currentUserId={user?.id ?? ''} />
      </RoleGate>
      <TeamOverview
        members={members as (Profile & { tasks: Task[]; overdue: number; uploads?: { raw: number; broll: number; edited: number; total: number } })[]}
      />
    </div>
  )
}
