import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getActivityLog } from '@/lib/actions/activity'
import { ActivityFeed } from '@/components/activity/activity-feed'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Activity log: who did what across the content pipeline. Reads the existing
 * content_idea_activity audit log, filterable by person. Gated by activity.read.
 */
export default async function ActividadPage() {
  await requirePermission('activity.read')
  const supabase = await createClient()
  const [activity, { data: members }] = await Promise.all([
    getActivityLog({ limit: 300 }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])
  return (
    <ActivityFeed
      activity={activity}
      members={(members ?? []) as { id: string; full_name: string | null }[]}
    />
  )
}
