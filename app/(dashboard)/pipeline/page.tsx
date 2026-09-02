import { requirePermission, currentUserHas, getEffectiveRole, getEffectiveUserId } from '@/lib/auth/server'
import { canSeeAllEditorBanks, editorWipIdeaIds, listBankAdmins, prepareIdeasForEditorBank } from '@/lib/pipeline/editor-video-bank'
import { planAutoAssign } from '@/lib/pipeline/auto-assign'
import { editorApprovalStats, editorWipLimitFor } from '@/lib/pipeline/editor-wip'
import { buildGlobalBroll } from '@/lib/pipeline/global-broll'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { createClient } from '@/lib/supabase/server'
import { shouldPlanForClient, planNextVideoSlot } from '@/lib/utils/planned-sessions'
import { resolveClientLogo } from '@/lib/utils/client-logo'
import { getWorkflowSettings } from '@/lib/utils/workflow-progress'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'
import { computeRunway } from '@/lib/utils/content-runway'
import { resolveStepAssignee, type PipelineStepAssignees } from '@/lib/utils/pipeline-step-assignees'
import { ContentPipelineBoard, type PlannedClient } from '@/components/pipeline/content-pipeline-board'
import { toBoardIdeas, type PipelineBoardIdea } from '@/lib/pipeline/board-idea'
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

  let [ideasRaw, { data: activeClientsRaw, error: clientsError }, metricoolPics, workflowSettings, { data: teamProfiles }, role, userId, pipelineTotals] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, logo_url, brand_colors, created_at, updated_at, platforms, status, posting_days, posting_time, metricool_blog_id')
      .eq('status', 'active')
      .order('name'),
    getMetricoolPicturesByBlogId(),
    getWorkflowSettings(),
    supabase.from('profiles').select('id, full_name, email, role, status').eq('status', 'active'),
    getEffectiveRole(),
    getEffectiveUserId(),
    getPipelineTotals(),
  ])

  // WIP dinámico: cada editor gana espacios con volumen + % de aprobación.
  const editorProfiles = (teamProfiles ?? []).filter((p) => p.role === 'editor' || p.role === 'team_member')
  const statsByEditor = Object.fromEntries(editorProfiles.map((p) => [p.id, editorApprovalStats(ideasRaw, p.id)]))
  const wipLimits: Record<string, number> = Object.fromEntries(
    editorProfiles.map((p) => [p.id, editorWipLimitFor(statsByEditor[p.id])]),
  )
  // % de aprobación al lado del nombre (null sin historial).
  const approvalRates: Record<string, number | null> = Object.fromEntries(
    editorProfiles.map((p) => {
      const st = statsByEditor[p.id]
      const total = st.approved + st.returned
      return [p.id, total === 0 ? null : Math.round((st.approved / total) * 100)]
    }),
  )
  // Autoasignación: los crudos sin editor se reparten solos a los espacios
  // libres por prioridad, al entrar un admin (planning.assign). Idempotente —
  // lo ya asignado nunca entra al plan, así que recargar no re-baraja nada.
  if (await currentUserHas('planning.assign')) {
    const autoEditors = (teamProfiles ?? [])
      .filter((p) => p.role === 'editor' || p.role === 'team_member')
      .map((p) => ({
        id: p.id,
        freeSlots: Math.max(
          0,
          (wipLimits[p.id] ?? 0) - editorWipIdeaIds(ideasRaw, p.id, undefined, wipLimits[p.id]).size,
        ),
      }))
    const plan = planAutoAssign(ideasRaw, autoEditors)
    if (plan.length > 0) {
      await Promise.all(
        plan.map((move) =>
          supabase
            .from('production_tasks')
            .update({ assigned_to_id: move.editorId })
            .eq('id', move.productionTaskId)
            .is('assigned_to_id', null),
        ),
      )
      // Releer para que el reparto se vea en esta misma carga.
      ideasRaw = await getIdeacionPipeline({ limit: 400 })
    }
  }

  const ideas = prepareIdeasForEditorBank(ideasRaw, { role, userId }, {
    wipLimit: userId ? wipLimits[userId] : undefined,
  })
  // B-roll global: lo ve todo editor, de todos los clientes (raw sigue scoped).
  const globalBroll = buildGlobalBroll(ideasRaw)
  const canSeeAll = canSeeAllEditorBanks(role)
  const visibleClientIds = new Set(ideas.map((idea) => idea.client?.id ?? idea.client_id).filter(Boolean))
  const allActiveClients = clientsError || !activeClientsRaw ? [] : activeClientsRaw
  const activeClients = canSeeAll
    ? allActiveClients
    : allActiveClients.filter((client) => visibleClientIds.has(client.id))
  const visibleProfiles = canSeeAll
    ? (teamProfiles ?? [])
    : (teamProfiles ?? []).filter((profile) => profile.id === userId)
  const clientRunway = Object.fromEntries(
    pipelineTotals.perClient
      .filter((client) => canSeeAll || visibleClientIds.has(client.clientId))
      .map((client) => [
        client.clientId,
        computeRunway({
          ideas: client.ideas,
          porEditar: client.porEditar,
          porPublicar: client.porPublicar,
          weeklyCadence: client.targetSemana,
        }),
      ]),
  )
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
    visibleProfiles.map((p) => [p.id, p.full_name ?? 'Sin nombre']),
  )
  const plannedClients = canSeeAll
    ? buildPlannedClients(
        ideas,
        activeClients,
        metricoolPics,
        workflowSettings.pipeline_step_assignees,
        profilesById,
      )
    : []

  const teamMembers = visibleProfiles.map((p) => ({
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
      ideas={toBoardIdeas(ideas)}
      plannedClients={plannedClients}
      allClients={allClients}
      clientCadence={clientCadence}
      teamMembers={teamMembers}
      clientLogos={clientLogos}
      clientColors={clientColors}
      clientRunway={clientRunway}
      wipLimits={wipLimits}
      approvalRates={approvalRates}
      globalBroll={globalBroll}
      bankAdmins={canSeeAll ? listBankAdmins(teamProfiles ?? []) : []}
      canSeeAll={canSeeAll}
    />
  )
}

/**
 * Planned-session cards (empty slots) for every ACTIVE client with a posting
 * cadence that hasn't started yet. Clients already being worked keep their real
 * batch card, so nothing shows twice (see shouldPlanForClient).
 */
function buildPlannedClients(
  ideas: PipelineBoardIdea[],
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
