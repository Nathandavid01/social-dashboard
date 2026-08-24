import { requirePermission, getEffectiveRole, getEffectiveUserId } from '@/lib/auth/server'
import { prepareIdeasForEditorBank } from '@/lib/pipeline/editor-video-bank'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { createClient } from '@/lib/supabase/server'
import { shouldPlanForClient, planNextVideoSlot } from '@/lib/utils/planned-sessions'
import { resolveClientLogo } from '@/lib/utils/client-logo'
import { getWorkflowSettings } from '@/lib/utils/workflow-progress'
import { resolveStepAssignee, type PipelineStepAssignees } from '@/lib/utils/pipeline-step-assignees'
import { ContentPipelineBoard, type PlannedClient } from '@/components/pipeline/content-pipeline-board'
import type { ClientCadence, BatchStageKey } from '@/lib/utils/content-batches'
import type { SocialPlatform } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Paso 2: banco de crudos por editor (y lotes para owner/supervisor).
 */
export default async function PipelinePage() {
  await requirePermission('pipeline.read')
  const supabase = await createClient()

  const [ideasRaw, { data: activeClientsRaw, error: clientsError }, metricoolPics, workflowSettings, { data: teamProfiles }, role, userId] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, logo_url, brand_colors, created_at, updated_at, platforms, status, posting_days, posting_time, metricool_blog_id')
      .eq('status', 'active')
      .order('name'),
    getMetricoolPicturesByBlogId(),
    getWorkflowSettings(),
    supabase.from('profiles').select('id, full_name').eq('status', 'active'),
    getEffectiveRole(),
    getEffectiveUserId(),
  ])

  const ideas = prepareIdeasForEditorBank(ideasRaw, { role, userId })
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
  const profilesById = Object.fromEntries(
    (teamProfiles ?? []).map((p) => [p.id, p.full_name ?? 'Sin nombre']),
  )
  const plannedClients = buildPlannedClients(
    ideas,
    activeClients,
    metricoolPics,
    workflowSettings.pipeline_step_assignees,
    profilesById,
  )

  const teamMembers = (teamProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? 'Sin nombre',
  }))

  // Same logo resolution as planned cards: uploaded logo_url, else Metricool pic.
  const clientLogos: Record<string, string | null> = Object.fromEntries(
    activeClients.map((c) => {
      const metricoolPic = c.metricool_blog_id ? metricoolPics[String(c.metricool_blog_id)] : undefined
      return [c.id, resolveClientLogo(c.logo_url, metricoolPic)]
    }),
  )
  const clientColors: Record<string, string | null> = Object.fromEntries(
    activeClients.map((c) => {
      const primary = (c as { brand_colors?: { primary?: string | null } | null }).brand_colors?.primary ?? null
      return [c.id, primary]
    }),
  )

  return (
    <ContentPipelineBoard
      ideas={ideas}
      plannedClients={plannedClients}
      allClients={allClients}
      clientCadence={clientCadence}
      teamMembers={teamMembers}
      clientLogos={clientLogos}
      clientColors={clientColors}
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
  metricoolPics: Record<string, string>,
  stepAssignees: PipelineStepAssignees,
  profilesById: Record<string, string>,
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
    const metricoolPic = c.metricool_blog_id ? metricoolPics[String(c.metricool_blog_id)] : undefined
    const nextStage: BatchStageKey = 'video'
    planned.push({
      clientId: c.id,
      clientName: c.name,
      logoUrl: resolveClientLogo(c.logo_url, metricoolPic),
      nextStage,
      stepAssignee: resolveStepAssignee(nextStage, stepAssignees, profilesById),
      createdAt: c.created_at,
      inColumnSince: c.updated_at,
      platforms: (c.platforms ?? []) as SocialPlatform[],
      sessions: [nextVideo],
    })
  }
  return planned
}
