import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { resolveInterval } from '@/lib/utils/recording-window'
import { planSessions, shouldPlanForClient } from '@/lib/utils/planned-sessions'
import { ContentPipelineBoard, type PlannedClient } from '@/components/pipeline/content-pipeline-board'
import type { SocialPlatform } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

/**
 * Planned-session cards (empty slots) for every ACTIVE client with a posting
 * cadence that hasn't started yet. Clients already being worked keep their real
 * batch card, so nothing shows twice (see shouldPlanForClient).
 */
async function buildPlannedClients(
  ideas: Awaited<ReturnType<typeof getIdeacionPipeline>>,
): Promise<PlannedClient[]> {
  const supabase = await createClient()
  // NOTE: recording_interval_weeks (migration 0029) isn't applied in prod yet, so
  // we don't select it — we use the default interval. Read it here once it lands.
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, platforms, status, posting_days')
    .eq('status', 'active')
  if (error || !data) return []

  // Count active (non-discarded) ideas per client to know who has started.
  const activeIdeasByClient = new Map<string, number>()
  for (const i of ideas) {
    if (i.status === 'descartada' || !i.client_id) continue
    activeIdeasByClient.set(i.client_id, (activeIdeasByClient.get(i.client_id) ?? 0) + 1)
  }

  const planned: PlannedClient[] = []
  for (const c of data) {
    const postingDays = (c.posting_days ?? []) as number[]
    const activeIdeasCount = activeIdeasByClient.get(c.id) ?? 0
    if (!shouldPlanForClient({ status: c.status, postingDaysLength: postingDays.length, activeIdeasCount })) {
      continue
    }
    const sessions = planSessions({
      monthlyTarget: computePostingTargets(postingDays).perMonth,
      perWeek: postingDays.length,
      intervalWeeks: resolveInterval(null),
      ideasCount: 0,
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
