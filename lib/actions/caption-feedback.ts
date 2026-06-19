'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

/**
 * Rate a generated caption 👍 (1) or 👎 (-1) with an optional note (fase 2 of the
 * learning loop). The caption text is snapshotted so the signal survives later
 * edits; client_id is resolved from the idea. Gated by `captions.use` (the same
 * people who generate captions rate them).
 *
 * Requires migration 0041 (caption_feedback). Until applied, the insert errors
 * and we surface it to the UI as a toast — reads degrade to [] elsewhere.
 */
export async function rateCaption(input: {
  ideaId: string
  rating: 1 | -1
  captionText: string
  note?: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const text = input.captionText?.trim()
  if (!text) return { error: 'No hay caption que calificar.' }
  if (input.rating !== 1 && input.rating !== -1) return { error: 'Calificación inválida.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Resolve the client this caption belongs to (so the rating feeds that
  // client's learning loop).
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('client_id')
    .eq('id', input.ideaId)
    .maybeSingle()

  const { error } = await supabase.from('caption_feedback').insert({
    client_id: (idea as { client_id?: string | null } | null)?.client_id ?? null,
    idea_id: input.ideaId,
    caption_text: text,
    rating: input.rating,
    note: input.note?.trim() || null,
    rated_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath(`/produccion/idea/${input.ideaId}`)
  revalidatePath('/planning')
  revalidatePath('/pipeline')
  return { ok: true }
}
