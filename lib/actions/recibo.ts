'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getEntregaVideoEditado, getEntregasDownloadUrl, getEntregasPreviewUrl } from '@/lib/actions/entregas-r2'
import { runReciboPublishedMatch } from '@/lib/recibo/sync-published'

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

const MATCH_EVERY_MS = 60_000
let lastMatchAt = 0

/**
 * On opening Recibo: link the cuts the team already posted by hand in Metricool
 * (same run as the daily cron), so they leave Recibo without waiting a day.
 * At most once a minute per server instance — Recibo reloads a lot.
 */
export async function syncReciboPublished(): Promise<{ linked: number; error?: string }> {
  try {
    await requirePermission('entregas.read')
  } catch (err) {
    return { linked: 0, error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (Date.now() - lastMatchAt < MATCH_EVERY_MS) return { linked: 0 }
  lastMatchAt = Date.now()

  const res = await runReciboPublishedMatch()
  if (res.linked > 0) {
    revalidatePath('/recibo')
    revalidatePath('/entregas')
    revalidatePath('/pool')
  }
  return res
}

/**
 * Presigned playback URL for the idea's current edited Entregas file.
 * Usable as <video src>. Does not touch Pipeline raw.
 */
export async function getReciboIdeaPreviewUrl(
  ideaId: string,
  expectedVideoId?: string,
): Promise<{ url?: string; error?: string }> {
  const edited = await currentReciboCut(ideaId, expectedVideoId)
  return edited.id ? getEntregasPreviewUrl(edited.id) : { error: edited.error }
}

/**
 * Presigned GET that forces a download of the cut the card is showing — "Bajar".
 * Same pin as the preview: a newer upload means the card is stale, so it
 * refuses instead of handing over a cut nobody on Recibo has seen.
 */
export async function getReciboIdeaDownloadUrl(
  ideaId: string,
  expectedVideoId?: string,
): Promise<{ url?: string; error?: string }> {
  const edited = await currentReciboCut(ideaId, expectedVideoId)
  return edited.id ? getEntregasDownloadUrl(edited.id) : { error: edited.error }
}

async function currentReciboCut(
  ideaId: string,
  expectedVideoId?: string,
): Promise<{ id?: string; error?: string }> {
  if (!ideaId) return { error: 'Falta el video' }

  const edited = await getEntregaVideoEditado(ideaId)
  if (edited.error) return { error: edited.error }
  if (!edited.id) return { error: 'Sin video editado' }
  if (expectedVideoId && edited.id !== expectedVideoId) {
    return { error: 'El video cambió. Vuelve a cargar Recibo.' }
  }
  return { id: edited.id }
}
