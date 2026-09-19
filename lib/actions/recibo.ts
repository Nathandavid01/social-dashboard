'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

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
  return { ok: true }
}
