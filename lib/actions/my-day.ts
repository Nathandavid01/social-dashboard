'use server'

import { createClient } from '@/lib/supabase/server'
import { buildMyDay, type MyDay, type OwnedVideo } from '@/lib/utils/my-day-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

/** Everything is scheduled in Puerto Rico time; the server runs in UTC. */
const POST_TZ = 'America/Puerto_Rico'

/**
 * The videos on MY plate today.
 *
 * Ownership is resolved in `videoOwnerId`: the per-video assignment wins, else
 * whoever runs the client. So we can't filter in SQL — we fetch the active
 * videos and let the pure core decide. That also lets it fall back to the team's
 * unowned work when I have nothing assigned (see `buildMyDay`).
 *
 * Anchored to Puerto Rico time on purpose: `todayISO()` uses the server's UTC
 * clock, which is already tomorrow late at night — every video due today would
 * silently flip to "atrasado" after 8pm.
 *
 * Returns null only when there's no session. A query failure degrades to an
 * empty day rather than exploding the page.
 */
export async function getMyDay(): Promise<MyDay | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // `select('*')` so this keeps working before migration 0045 is applied — the
  // column is simply absent and capacity stays null (no ceiling, no warnings).
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const capacity =
    (profile as { daily_video_capacity?: number | null } | null)?.daily_video_capacity ?? null

  // Only work that could still be on someone's plate. Published/discarded rows
  // are dropped again in the core (belt and braces), but not fetching them keeps
  // this cheap as the table grows.
  const { data, error } = await supabase
    .from('content_ideas')
    .select(
      `
      *,
      client:clients!content_ideas_client_id_fkey(id, name, industry, logo_url, assigned_to),
      videos:content_idea_videos!content_idea_videos_idea_id_fkey(*),
      production_task:production_tasks!content_ideas_production_task_id_fkey(id, status, publish_date, assigned_to_id)
    `,
    )
    .is('published_at', null)
    .not('status', 'in', '(publicada,descartada)')
    .limit(500)

  if (error) {
    console.warn('[my-day] fetch failed:', error.message)
    return buildMyDay([], { today: todayISOInTimeZone(POST_TZ), userId: user.id, capacity })
  }

  const videos: OwnedVideo[] = (data ?? []).map((row) => {
    const r = row as unknown as OwnedVideo & { videos?: ContentIdeaVideo[] | null }
    const files = (r.videos as unknown as ContentIdeaVideo[] | null) ?? []
    return {
      ...r,
      videos: {
        raw: files.filter((f) => f.kind === 'raw' && f.status !== 'archived'),
        broll: files.filter((f) => f.kind === 'broll' && f.status !== 'archived'),
        edited: files.filter((f) => f.kind === 'edited' && f.status !== 'archived'),
      },
    }
  })

  return buildMyDay(videos, {
    today: todayISOInTimeZone(POST_TZ),
    userId: user.id,
    capacity,
  })
}
