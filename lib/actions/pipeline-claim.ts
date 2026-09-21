'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, getEffectiveUserId, requirePermission } from '@/lib/auth/server'
import {
  editingClaimConflictMessage,
  editingClaimFromFields,
  type EditingClaim,
} from '@/lib/pipeline/editing-claim'

export type PipelineClaimResult =
  | { ok: true; claim: EditingClaim }
  | { error: string; claim?: EditingClaim }

export type PipelineReleaseResult = { ok: true } | { error: string }

function deny(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : 'Acceso denegado' }
}

async function holderClaim(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ideaId: string,
): Promise<EditingClaim> {
  const { data: row } = await supabase
    .from('content_ideas')
    .select('editing_started_by, editing_started_at')
    .eq('id', ideaId)
    .maybeSingle()
  const byId = (row?.editing_started_by as string | null | undefined) ?? null
  let name: string | null = null
  if (byId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', byId)
      .maybeSingle()
    name = profile?.full_name ?? null
  }
  return editingClaimFromFields(byId, (row?.editing_started_at as string | null | undefined) ?? null, name)
}

/** One-tap “estoy editando este corte”. Atomic: free or already mine. */
export async function claimPipelineEdit(ideaId: string): Promise<PipelineClaimResult> {
  try {
    await requirePermission('pipeline.claim')
  } catch (error) {
    return deny(error)
  }
  const userId = await getEffectiveUserId()
  if (!userId) return { error: 'Debes iniciar sesión.' }

  const supabase = await createClient()
  const at = new Date().toISOString()
  const { data: claimed, error } = await supabase
    .from('content_ideas')
    .update({ editing_started_by: userId, editing_started_at: at })
    .eq('id', ideaId)
    .or(`editing_started_by.is.null,editing_started_by.eq.${userId}`)
    .select('id, editing_started_by, editing_started_at')

  if (error) return { error: error.message }
  if (!claimed || claimed.length === 0) {
    const claim = await holderClaim(supabase, ideaId)
    return { error: editingClaimConflictMessage(claim), claim }
  }

  revalidatePath('/pipeline')
  return { ok: true, claim: { byId: userId, byName: null, at } }
}

/** Soltar el corte. El dueño, o quien tenga planning.assign. */
export async function releasePipelineEdit(ideaId: string): Promise<PipelineReleaseResult> {
  try {
    await requirePermission('pipeline.claim')
  } catch (error) {
    return deny(error)
  }
  const userId = await getEffectiveUserId()
  if (!userId) return { error: 'Debes iniciar sesión.' }

  const supabase = await createClient()
  const canForce = await currentUserHas('planning.assign')
  let query = supabase
    .from('content_ideas')
    .update({ editing_started_by: null, editing_started_at: null })
    .eq('id', ideaId)
  if (!canForce) query = query.eq('editing_started_by', userId)
  const { data, error } = await query.select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Solo quien lo reclamó (o un admin) puede soltarlo.' }
  }
  revalidatePath('/pipeline')
  return { ok: true }
}
