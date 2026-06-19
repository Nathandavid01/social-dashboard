'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { detectRecurringFeedback } from '@/lib/utils/caption-learning'

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
  /** Rate a pipeline caption (resolves the client from the idea). */
  ideaId?: string
  /** Rate a standalone "caption rápido" directly by client (no idea row). */
  clientId?: string
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
  if (!input.ideaId && !input.clientId) return { error: 'Falta el cliente o la idea.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Resolve the client this caption belongs to (so the rating feeds that
  // client's learning loop). A quick caption passes clientId directly; a
  // pipeline caption resolves it from the idea.
  let clientId = input.clientId ?? null
  if (!clientId && input.ideaId) {
    const { data: idea } = await supabase
      .from('content_ideas')
      .select('client_id')
      .eq('id', input.ideaId)
      .maybeSingle()
    clientId = (idea as { client_id?: string | null } | null)?.client_id ?? null
  }

  const { error } = await supabase.from('caption_feedback').insert({
    client_id: clientId,
    idea_id: input.ideaId ?? null,
    caption_text: text,
    rating: input.rating,
    note: input.note?.trim() || null,
    rated_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  if (input.ideaId) revalidatePath(`/produccion/idea/${input.ideaId}`)
  revalidatePath('/planning')
  revalidatePath('/pipeline')
  return { ok: true }
}

/** Target for the shared caption module: a pipeline idea, or a client directly. */
export type CaptionTarget = { ideaId?: string; clientId?: string }

/** Resolve the client a caption belongs to from either an ideaId or a direct clientId. */
async function resolveClientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: CaptionTarget,
): Promise<string | null> {
  if (target.clientId) return target.clientId
  if (target.ideaId) {
    const { data } = await supabase.from('content_ideas').select('client_id').eq('id', target.ideaId).maybeSingle()
    return (data as { client_id?: string | null } | null)?.client_id ?? null
  }
  return null
}

/**
 * Per-client caption-learning stats for the transparency chip:
 * how many APPROVED + 👍 captions inform generation, plus recurring 👎 notes
 * worth turning into a standing rule. Works for ANY caption surface (pipeline
 * idea or quick/client). Best-effort: any error → zeros (so the UI just hides
 * the chip; works before migration 0041 too).
 */
export async function getCaptionLearningStats(
  target: CaptionTarget,
): Promise<{ approved: number; loved: number; rejected: number; suggestions: { phrase: string; count: number }[] }> {
  const empty = { approved: 0, loved: 0, rejected: 0, suggestions: [] as { phrase: string; count: number }[] }
  try {
    await requirePermission('captions.use')
  } catch {
    return empty
  }
  try {
    const supabase = await createClient()
    const clientId = await resolveClientId(supabase, target)
    if (!clientId) return empty

    const [approvedRes, lovedRes, rejectedRes, notesRes] = await Promise.all([
      supabase
        .from('content_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('approval_status', 'approved')
        .not('generated_caption', 'is', null),
      supabase.from('caption_feedback').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('rating', 1),
      supabase.from('caption_feedback').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('rating', -1),
      supabase
        .from('caption_feedback')
        .select('note')
        .eq('client_id', clientId)
        .eq('rating', -1)
        .not('note', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const notes = ((notesRes.data ?? []) as { note: string | null }[]).map((r) => r.note)
    return {
      approved: approvedRes.count ?? 0,
      loved: lovedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
      suggestions: detectRecurringFeedback(notes),
    }
  } catch {
    return empty
  }
}

/**
 * Append a recurring 👎 reason to the client's caption rules (clients.caption_notes)
 * so the generator treats it as a standing constraint. Idempotent-ish: skips if the
 * rule text is already present. Gated by clients.brand.edit (it edits brand config).
 */
export async function appendClientCaptionRule(
  target: CaptionTarget,
  rule: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('clients.brand.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const text = rule?.trim()
  if (!text) return { error: 'Regla vacía.' }

  const supabase = await createClient()
  const clientId = await resolveClientId(supabase, target)
  if (!clientId) return { error: 'Cliente no encontrado.' }

  const { data: client } = await supabase.from('clients').select('caption_notes').eq('id', clientId).maybeSingle()
  const current = ((client as { caption_notes?: string | null } | null)?.caption_notes ?? '').trim()
  if (current.toLowerCase().includes(text.toLowerCase())) return { ok: true } // already a rule
  const next = current ? `${current}\n- ${text}` : `- ${text}`

  const { error } = await supabase.from('clients').update({ caption_notes: next }).eq('id', clientId)
  if (error) return { error: error.message }

  if (target.ideaId) revalidatePath(`/produccion/idea/${target.ideaId}`)
  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}
