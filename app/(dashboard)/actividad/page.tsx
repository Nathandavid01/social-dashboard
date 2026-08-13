import { getCurrentRole, requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getActivityLog } from '@/lib/actions/activity'
import { getUiEvents } from '@/lib/actions/ui-events'
import { ActivityWorkspace } from '@/components/activity/activity-workspace'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { UI_EVENT_TZ } from '@/lib/utils/ui-events-core'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Activity log: pipeline actions (activity.read) plus the owner-only session
 * tab (clicks + routes for the Puerto Rico calendar day).
 */
export default async function ActividadPage() {
  await requirePermission('activity.read')
  const supabase = await createClient()
  const [{ data: { user } }, role] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentRole(),
  ])
  const isOwner = role === 'owner'
  const day = todayISOInTimeZone(UI_EVENT_TZ)
  const [activity, session, { data: members }] = await Promise.all([
    getActivityLog({ limit: 300 }),
    isOwner ? getUiEvents({ day }) : Promise.resolve([]),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])
  return (
    <ActivityWorkspace
      activity={activity}
      session={session}
      members={(members ?? []) as { id: string; full_name: string | null }[]}
      canViewSession={isOwner}
      currentUserId={user?.id ?? null}
      day={day}
    />
  )
}
