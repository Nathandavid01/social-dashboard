import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { resolveInterval } from '@/lib/utils/recording-window'
import { planSessions } from '@/lib/utils/planned-sessions'
import { ContentPipelineBoard, type PlannedClient } from '@/components/pipeline/content-pipeline-board'
import type { SocialPlatform } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Pilot rollout: show planned recording sessions (empty slots, waiting for ideas)
 * only for this client for now. Flip this to all active clients with cadence once
 * validated. See planSessions() for the monthly→sessions math.
 */
const PLANNED_SESSIONS_CLIENT_IDS = ['b7f932b9-7276-4020-bddd-fe35b81547be']

/**
 * Global Content Pipeline board — every client's videos on one Trello-style
 * board, filterable by client. Reference design: "Content Pipeline Board".
 */
export default async function PipelinePage() {
  await requirePermission('planning.read')
  const ideas = await getIdeacionPipeline({ limit: 400 })

  const plannedClients = await buildPlannedClients(ideas)

  return <ContentPipelineBoard ideas={ideas} plannedClients={plannedClients} />
}

/** Compute the planned-session cards (empty slots) for the piloted clients. */
async function buildPlannedClients(
  ideas: Awaited<ReturnType<typeof getIdeacionPipeline>>,
): Promise<PlannedClient[]> {
  if (PLANNED_SESSIONS_CLIENT_IDS.length === 0) return []
  const supabase = await createClient()
  // NOTE: recording_interval_weeks (migration 0029) isn't applied in prod yet, so
  // we don't select it — we use the default interval. Read it here once it lands.
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, platforms, status, posting_days')
    .in('id', PLANNED_SESSIONS_CLIENT_IDS)
  if (error || !data) return []

  const planned: PlannedClient[] = []
  for (const c of data) {
    const postingDays = (c.posting_days ?? []) as number[]
    const monthlyTarget = computePostingTargets(postingDays).perMonth
    const ideasCount = ideas.filter(
      (i) => i.client_id === c.id && i.status !== 'descartada',
    ).length
    const sessions = planSessions({
      monthlyTarget,
      perWeek: postingDays.length,
      intervalWeeks: resolveInterval(null),
      ideasCount,
    })
    if (sessions.length === 0) continue
    planned.push({
      clientId: c.id,
      clientName: c.name,
      platforms: (c.platforms ?? []) as SocialPlatform[],
      sessions,
    })
  }
  return planned
}
