'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getEntregaVideoEditado, getEntregasPreviewUrl } from '@/lib/actions/entregas-r2'
import {
  canSendHumanReciboToPool,
  humanPoolGate,
  humanPoolGateMessage,
} from '@/lib/utils/client-pool-state'

export type ManualPostedStatus = 'posted' | 'not_posted' | null
export type StaffClientApproval = 'approved' | 'rejected' | null

/**
 * Staff toggles on Recibo — independent of Metricool posted_at and of the
 * public /aprobacion vote. Clearing passes null.
 */
export async function setManualPostedStatus(input: {
  ideaId: string
  status: ManualPostedStatus
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('entregas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!input.ideaId) return { error: 'Falta el video' }
  if (input.status != null && input.status !== 'posted' && input.status !== 'not_posted') {
    return { error: 'Estado de publicación no válido' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ manual_posted_status: input.status })
    .eq('id', input.ideaId)

  if (error) return { error: error.message }
  revalidatePath('/recibo')
  revalidatePath('/entregas')
  revalidatePath('/pool')
  return { ok: true }
}

export async function setStaffClientApproval(input: {
  ideaId: string
  status: StaffClientApproval
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('entregas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!input.ideaId) return { error: 'Falta el video' }
  if (input.status != null && input.status !== 'approved' && input.status !== 'rejected') {
    return { error: 'Estado de aprobación no válido' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ staff_client_approval: input.status })
    .eq('id', input.ideaId)

  if (error) return { error: error.message }
  revalidatePath('/recibo')
  revalidatePath('/entregas')
  revalidatePath('/pool')
  return { ok: true }
}

/**
 * Optional staff CTA: put an approved human Entregas/Recibo cut into the
 * client pool as Listo. Never automatic. Server gate (do not skip Revisión):
 * human edit_mode + client approved + approval_status === 'approved'.
 */
export async function sendHumanReciboToPool(input: {
  ideaId: string
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('pool.send_human')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!input.ideaId) return { error: 'Falta el video' }

  const supabase = await createClient()
  const { data: idea, error: ideaErr } = await supabase
    .from('content_ideas')
    .select(
      'id, status, approval_status, staff_client_approval, client_review_status, staff_pool_ready, published_at, metricool_post_id, posted_at, manual_posted_status, client:clients(edit_mode)',
    )
    .eq('id', input.ideaId)
    .single()
  if (ideaErr || !idea) return { error: 'Idea no encontrada' }

  const { data: review } = await supabase
    .from('entregas_client_review_items')
    .select('status')
    .eq('idea_id', input.ideaId)
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const gateInput = {
    status: (idea.status as string | null) ?? null,
    approval_status: (idea.approval_status as string | null) ?? null,
    staff_client_approval: (idea.staff_client_approval as string | null) ?? null,
    client_review_status: (idea.client_review_status as string | null) ?? null,
    entregas_review_status: (review?.status as string | null) ?? null,
    staff_pool_ready: Boolean((idea as { staff_pool_ready?: boolean | null }).staff_pool_ready),
    published_at: (idea.published_at as string | null) ?? null,
    metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
    posted_at: (idea.posted_at as string | null) ?? null,
    manual_posted_status: (idea as { manual_posted_status?: string | null }).manual_posted_status ?? null,
    client_edit_mode: ((idea.client as { edit_mode?: 'ai' | 'human' | null } | null)?.edit_mode ?? null),
  }

  if (!canSendHumanReciboToPool(gateInput)) {
    return { error: humanPoolGateMessage(humanPoolGate(gateInput)) }
  }

  const { error } = await supabase
    .from('content_ideas')
    .update({ staff_pool_ready: true })
    .eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/recibo')
  revalidatePath('/entregas')
  revalidatePath('/pool')
  return { ok: true }
}

/**
 * Presigned playback URL for the idea's current edited Entregas file.
 * Usable as <video src>. Does not touch Pipeline raw.
 */
export async function getReciboIdeaPreviewUrl(
  ideaId: string,
): Promise<{ url?: string; error?: string }> {
  if (!ideaId) return { error: 'Falta el video' }

  const edited = await getEntregaVideoEditado(ideaId)
  if (edited.error) return { error: edited.error }
  if (!edited.id) return { error: 'Sin video editado' }

  return getEntregasPreviewUrl(edited.id)
}
