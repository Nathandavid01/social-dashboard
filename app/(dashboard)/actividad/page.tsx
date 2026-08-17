import { getCurrentRole, requirePermission, currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getActivityLog } from '@/lib/actions/activity'
import { getUiEvents } from '@/lib/actions/ui-events'
import { getTeamTimeBoard } from '@/lib/actions/presence'
import { ActivityWorkspace } from '@/components/activity/activity-workspace'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { UI_EVENT_TZ } from '@/lib/utils/ui-events-core'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Jornada del estudio (todo el equipo) + log de sesión (owner) + pipeline
 * (activity.read). La puerta de la página es presence.read — si no, el
 * editor nunca vería el ranking.
 */
export default async function ActividadPage() {
  await requirePermission('presence.read')
  const supabase = await createClient()
  const [{ data: { user } }, role, canViewPipeline] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentRole(),
    currentUserHas('activity.read'),
  ])
  const isOwner = role === 'owner'
  const day = todayISOInTimeZone(UI_EVENT_TZ)
  const [activity, session, board, { data: members }] = await Promise.all([
    canViewPipeline ? getActivityLog({ limit: 300 }) : Promise.resolve([]),
    isOwner ? getUiEvents({ day }) : Promise.resolve([]),
    getTeamTimeBoard(),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])
  return (
    <ActivityWorkspace
      activity={activity}
      session={session}
      members={(members ?? []) as { id: string; full_name: string | null }[]}
      canViewSession={isOwner}
      canViewPipeline={canViewPipeline}
      board={board}
      currentUserId={user?.id ?? null}
      day={day}
    />
  )
}
