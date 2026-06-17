'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import {
  aggregateUploadsByUser,
  joinUserNames,
  type UploadRow,
  type NamedUserUploadCounts,
} from '@/lib/utils/video-upload-metrics'

/**
 * How many video files each team member has uploaded, split by kind (raw /
 * b-roll / edited). Powers the per-member upload counts on the Team views.
 *
 * Gated by `team.read`. Degrades to [] on any read failure (logged) so the page
 * never throws. The counting itself lives in pure helpers (video-upload-metrics)
 * so it's unit-tested without a database.
 */
export async function getVideoUploadMetricsByUser(filter?: {
  /** Restrict to a single uploader (member profile page). */
  userId?: string
  /** Only count uploads on/after this date (e.g. start of week/month). */
  since?: string
}): Promise<NamedUserUploadCounts[]> {
  if (!(await currentUserHas('team.read'))) return []

  const supabase = await createClient()

  let videosQuery = supabase
    .from('content_idea_videos')
    .select('uploaded_by, kind, status, uploaded_at')
    .neq('status', 'archived')
  if (filter?.userId) videosQuery = videosQuery.eq('uploaded_by', filter.userId)

  const [videosRes, profilesRes] = await Promise.all([
    videosQuery,
    supabase.from('profiles').select('id, full_name'),
  ])

  if (videosRes.error) {
    console.warn('[video-uploads] fetch failed:', videosRes.error.message)
    return []
  }

  const rows = (videosRes.data ?? []) as UploadRow[]
  const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null }[]

  const aggregated = aggregateUploadsByUser(rows, { since: filter?.since })
  return joinUserNames(aggregated, profiles).sort((a, b) => b.total - a.total)
}
