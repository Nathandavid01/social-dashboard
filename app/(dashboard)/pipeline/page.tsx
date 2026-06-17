import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { shouldPlanForClient, planNextVideoSlot } from '@/lib/utils/planned-sessions'
import { ContentPipelineBoard, type PlannedClient } from '@/components/pipeline/content-pipeline-board'
import type { ClientCadence } from '@/lib/utils/content-batches'
import type { SocialPlatform } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Global Content Pipeline board — every client's videos on one Trello-style
 * board, filterable by client. Reference design: "Content Pipeline Board".
 */
export default async function PipelinePage() {
  await requirePermission('planning.read')
  const supabase = await createClient()

  const [ideas, { data: activeClientsRaw, error: clientsError }] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, logo_url, created_at, updated_at, platforms, status, posting_days, posting_time, metricool_blog_id')
      .eq('status', 'active')
      .order('name'),
  ])

  const activeClients = clientsError || !activeClientsRaw ? [] : activeClientsRaw
  const allClients = activeClients.map((c) => ({ id: c.id, name: c.name }))
  const clientCadence: Record<string, ClientCadence> = Object.fromEntries(
    activeClients.map((c) => [
      c.id,
      {
        postingTime: c.posting_time ?? null,
        postingDays: (c.posting_days ?? []) as number[],
        metricoolBlogId: c.metricool_blog_id ?? null,
      },
    ]),
  )
  const plannedClients = buildPlannedClients(ideas, activeClients)

  return (
    <ContentPipelineBoard
      ideas={ideas}
      plannedClients={plannedClients}
      allClients={allClients}
      clientCadence={clientCadence}
    />
  )
}

/**
 * Planned-session cards (empty slots) for every ACTIVE client with a posting
 * cadence that hasn't started yet. Clients already being worked keep their real
 * batch card, so nothing shows twice (see shouldPlanForClient).
 */
function buildPlannedClients(
  ideas: Awaited<ReturnType<typeof getIdeacionPipeline>>,
  activeClients: { id: string; name: string; logo_url: string | null; created_at: string; updated_at: string; platforms: string[] | null; status: string; posting_days: number[] | null; posting_time?: string | null; metricool_blog_id?: string | null }[],
): PlannedClient[] {
  // Count active (non-discarded) ideas per client to know who has started.
  const activeIdeasByClient = new Map<string, number>()
  for (const i of ideas) {
    if (i.status === 'descartada' || !i.client_id) continue
    activeIdeasByClient.set(i.client_id, (activeIdeasByClient.get(i.client_id) ?? 0) + 1)
  }

  const planned: PlannedClient[] = []
  for (const c of activeClients) {
    const postingDays = (c.posting_days ?? []) as number[]
    const activeIdeasCount = activeIdeasByClient.get(c.id) ?? 0
    if (!shouldPlanForClient({ status: c.status, postingDaysLength: postingDays.length, activeIdeasCount })) {
      continue
    }
    const nextVideo = planNextVideoSlot(postingDays, new Date())
    if (!nextVideo) continue
    planned.push({
      clientId: c.id,
      clientName: c.name,
      logoUrl: c.logo_url,
      createdAt: c.created_at,
      inColumnSince: c.updated_at,
      platforms: (c.platforms ?? []) as SocialPlatform[],
      sessions: [nextVideo],
    })
  }
  return planned
}
