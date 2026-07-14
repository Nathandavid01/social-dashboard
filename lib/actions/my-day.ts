'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { effectiveAreaHrefs } from '@/lib/auth/areas'
import type { UserRole } from '@/lib/supabase/types'
import { buildMyDay, type MyDay, type OwnedVideo } from '@/lib/utils/my-day-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

/** Everything is scheduled in Puerto Rico time; the server runs in UTC. */
const POST_TZ = 'America/Puerto_Rico'

/** Enough for every active video in the account, with headroom. */
const MAX_VIDEOS = 1000

export type MyDayResult = { day: MyDay; firstName: string | null } | null

/**
 * The videos on MY plate today.
 *
 * Ownership is resolved in `videoOwnerId` (per-video assignment wins, else
 * whoever runs the client), so we can't filter it in SQL — we fetch the active
 * videos and let the pure core decide. That also lets it fall back to the team's
 * unowned work when I have nothing assigned.
 *
 * Anchored to Puerto Rico time on purpose: `todayISO()` uses the server's UTC
 * clock, which is already tomorrow late at night — every video due today would
 * silently flip to "atrasado" after 8pm.
 */
export async function getMyDay(): Promise<MyDayResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // A server action is NOT behind the layout, so it has to re-check the account
  // itself: an authenticated-but-pending/deactivated user could otherwise call
  // this directly. `content_ideas` RLS is `using (true)` for any authenticated
  // role, so this check is the only gate there is.
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return null
  const p = profile as {
    full_name?: string | null
    role?: UserRole
    status?: string
    approval_status?: string
    area_access?: string[] | null
    daily_video_capacity?: number | null
  }
  if (
    p.status === 'inactive' ||
    p.approval_status === 'pending' ||
    p.approval_status === 'rejected'
  ) {
    return null
  }

  const capacity = p.daily_video_capacity ?? null
  const firstName = p.full_name?.trim().split(/\s+/)[0] ?? null
  const canApprove = await currentUserHas('video.approve')
  const canPublish = await currentUserHas('posting.publish')

  // Seeing the unowned team pool means seeing every client's titles — that IS the
  // pipeline, and the pipeline is gated. A user restricted out of it must not get
  // the same data through their own landing page.
  //
  // This asks the AREA system, not `currentUserHas`: every role in RBAC has
  // `planning.read`, and `currentUserHas` ORs the role in, so a permission check
  // here would be true for everybody and gate nothing. `effectiveAreaHrefs` is
  // what actually honors a per-user `area_access` restriction.
  const canSeeTeamPool = effectiveAreaHrefs(p.role, p.area_access ?? null).has('/pipeline')

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
    // Deterministic order: an unordered LIMIT drops an ARBITRARY subset, which
    // would silently hide someone's videos and under-report their count — the one
    // thing this screen must never do. `publish_date` repeats and is nullable, so
    // it can't order on its own; `id` is the tiebreak that makes it total.
    .order('publish_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(MAX_VIDEOS)

  const day = (videos: OwnedVideo[]): MyDay =>
    buildMyDay(videos, {
      today: todayISOInTimeZone(POST_TZ),
      userId: user.id,
      capacity,
      canApprove,
      canPublish,
    })

  if (error) {
    console.warn('[my-day] fetch failed:', error.message)
    return { day: day([]), firstName }
  }

  // If we ever hit the cap, work is being dropped and the count silently lies.
  // Say it out loud in the logs rather than quietly under-reporting.
  if ((data?.length ?? 0) >= MAX_VIDEOS) {
    console.warn(
      `[my-day] hit the ${MAX_VIDEOS}-video cap — some active videos were not considered. Raise MAX_VIDEOS or filter ownership in SQL.`,
    )
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

  const built = day(videos)
  // Fell back to the team pool but isn't allowed to see it → show an empty day
  // rather than every client's content. Mark it `restricted` so the screen says
  // "no puedes ver el trabajo del equipo" instead of the false "no hay trabajo".
  if (built.scope === 'equipo' && !canSeeTeamPool) {
    return { day: { ...day([]), restricted: true }, firstName }
  }
  return { day: built, firstName }
}
