import { notFound } from 'next/navigation'
import { getClientVideoBatch } from '@/lib/actions/video-pipeline'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { planSessions, planSlots, type PlannedSlot } from '@/lib/utils/planned-sessions'
import { resolveInterval } from '@/lib/utils/recording-window'
import { ClientBatchView } from '@/components/clients/batch/client-batch-view'

/**
 * Full-screen Client Batch view: opening a client shows the whole batch of
 * videos being worked, with a stage stepper, a "what to do next" hint, the video
 * grid and a master-detail panel. Designed for beginners and high-traffic use.
 *
 * When the client hasn't started yet (no videos), we show the planned empty
 * slots for the current recording session — each dated by the posting cadence,
 * waiting for its idea + caption to be made.
 */
export default async function ClientBatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('clients.read')
  const { id } = await params
  const pipeline = await getClientVideoBatch(id)
  if (!pipeline) notFound()

  const plannedSlots = pipeline.videos.length === 0 ? await buildPlannedSlots(id) : []

  return <ClientBatchView pipeline={pipeline} plannedSlots={plannedSlots} />
}

/** Empty, dated video slots for the client's current session (cadence-driven). */
async function buildPlannedSlots(clientId: string): Promise<PlannedSlot[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('posting_days')
    .eq('id', clientId)
    .maybeSingle()
  if (error || !data) return []

  const postingDays = (data.posting_days ?? []) as number[]
  if (postingDays.length === 0) return []

  const monthlyTarget = computePostingTargets(postingDays).perMonth
  const sessions = planSessions({
    monthlyTarget,
    perWeek: postingDays.length,
    intervalWeeks: resolveInterval(null),
    ideasCount: 0,
  })
  const sessionSize = sessions[0]?.total ?? 0
  if (sessionSize === 0) return []

  return planSlots(postingDays, sessionSize, new Date())
}
