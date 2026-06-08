'use server'

import { createClient } from '@/lib/supabase/server'
import type { ContentIdeaActivity } from '@/lib/supabase/types'

/** One activity row enriched with the actor, the video (idea) and the client. */
export interface ActivityLogEntry extends ContentIdeaActivity {
  client?: { id: string; name: string } | null
}

/**
 * The activity feed — who did what, across all clients/videos. Optionally scoped
 * to one person. Reads the existing content_idea_activity audit log (joined with
 * the actor, the idea and the client). Returns [] on read failure.
 */
export async function getActivityLog(opts?: {
  userId?: string | null
  limit?: number
}): Promise<ActivityLogEntry[]> {
  const supabase = await createClient()
  let query = supabase
    .from('content_idea_activity')
    .select(
      '*, user:profiles(id, full_name), idea:content_ideas(id, title, content_type), client:clients(id, name)',
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts?.limit ?? 200, 1), 500))

  if (opts?.userId) query = query.eq('user_id', opts.userId)

  const { data, error } = await query
  if (error) {
    console.warn('[activity] read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as ActivityLogEntry[]
}
