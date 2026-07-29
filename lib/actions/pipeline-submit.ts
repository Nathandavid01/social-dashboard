'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { applyReviewDecision } from '@/lib/utils/internal-review'
import type { ContentIdea, IdeaApprovalStatus } from '@/lib/supabase/types'

/**
 * Persistence for the pipeline board.
 *
 * The submit flow is two steps on purpose: the idea row must exist before a
 * video can be attached to it (getR2UploadUrl keys the object under the idea
 * id). So the client calls createSubmittedIdea, then presigns, PUTs the file
 * and calls registerR2Video — in that order.
 */

export async function createSubmittedIdea(input: {
  clientId: string
  title: string
  /** "De qué es el video" — the only field the caption AI requires. */
  hook?: string | null
  /** YYYY-MM-DD del día para el que se entrega. */
  publishDate?: string | null
  /**
   * Optional Drive reference for the reviewer. content_ideas has no free-text
   * column for it (verified against the live schema), so it rides in
   * visual_brief — the field the reviewer already reads — clearly labelled.
   * The published media always comes from R2, never from this link.
   */
  driveLink?: string | null
}): Promise<{ idea?: ContentIdea; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!input.clientId) return { error: 'Falta el cliente' }
  const title = input.title?.trim()
  if (!title) return { error: 'Falta el título del video' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: input.clientId,
      content_type: 'R',
      title,
      hook: input.hook?.trim() || null,
      // The editor is delivering an edited video, so the row enters the board
      // already produced and waiting on a reviewer.
      status: 'producida',
      approval_status: 'submitted' satisfies IdeaApprovalStatus,
      submitted_at: new Date().toISOString(),
      publish_date: input.publishDate || null,
      created_by: user?.id ?? null,
      visual_brief: input.driveLink?.trim()
        ? `Referencia en Drive: ${input.driveLink.trim()}`
        : null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return { idea: data as ContentIdea }
}

/**
 * Record a reviewer's decision. Re-reads the current status server-side and
 * runs it through applyReviewDecision, so a stale board can't approve a video
 * that someone else already sent back.
 */
export async function decideReview(input: {
  ideaId: string
  decision: 'approve' | 'request_changes'
  note?: string
}): Promise<{ ok?: true; status?: IdeaApprovalStatus; error?: string }> {
  try {
    await requirePermission('video.approve')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (input.decision === 'request_changes' && !input.note?.trim()) {
    return { error: 'Di qué hay que cambiar — el editor necesita saberlo.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: idea, error: readErr } = await supabase
    .from('content_ideas')
    .select('id, approval_status, created_by')
    .eq('id', input.ideaId)
    .single()
  if (readErr || !idea) return { error: 'Video no encontrado' }

  // Nobody reviews their own submission — the whole point of the stage is a
  // second pair of eyes. Enforced here too, not just in the UI.
  if (idea.created_by && user?.id && idea.created_by === user.id) {
    return { error: 'No puedes revisar tu propio video.' }
  }

  const next = applyReviewDecision(idea.approval_status as IdeaApprovalStatus, input.decision)
  if (!next) return { error: 'Este video ya no está en revisión.' }

  const { error } = await supabase
    .from('content_ideas')
    .update({
      approval_status: next,
      approved_by: next === 'approved' ? user?.id ?? null : null,
      approved_at: next === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return { ok: true, status: next }
}

/** The editor resubmits after fixing what the reviewer asked for. */
export async function resubmitForReview(ideaId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('approval_status')
    .eq('id', ideaId)
    .single()
  if (!idea) return { error: 'Video no encontrado' }

  const next = applyReviewDecision(idea.approval_status as IdeaApprovalStatus, 'submit')
  if (!next) return { error: 'Este video no está esperando cambios.' }

  const { error } = await supabase
    .from('content_ideas')
    .update({ approval_status: next, submitted_at: new Date().toISOString() })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return { ok: true }
}


/**
 * The browser reports why an upload died. A CORS block or a network drop never
 * reaches the server on its own — the PUT goes straight to R2 — so without this
 * the failure is invisible in the logs and only the user sees it.
 */
export async function reportUploadFailure(detail: string): Promise<void> {
  console.error('[subida fallida]', detail)
}

/**
 * Take a batch off the board.
 *
 * Marks the rows `descartada` instead of deleting them: the board already
 * excludes that status everywhere, so the card disappears exactly as a delete
 * would — but the video, its copy and its history survive. An X on a card is
 * one misclick away, and a misclick shouldn't destroy an editor's work.
 */
export async function discardEntregaVideos(
  ideaIds: string[],
): Promise<{ ok?: true; count?: number; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (ideaIds.length === 0) return { error: 'Nada que descartar' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ status: 'descartada' })
    .in('id', ideaIds)
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  return { ok: true, count: ideaIds.length }
}
