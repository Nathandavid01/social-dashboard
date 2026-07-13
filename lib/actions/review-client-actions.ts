'use server'

import { revalidatePath } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { normalizeDecision } from '@/lib/utils/review-link-core'
import { notifyStaffOfClientReview } from '@/lib/actions/review-notify'
import { autopostOnClientVote } from '@/lib/actions/review-autopost'

export type ClientActionResult = { ok?: true; status?: string; error?: string }

/**
 * Client-side (unauthenticated) actions for the public review link. Both go
 * through the SECURITY DEFINER RPCs of migration 0042, which re-validate the
 * token + expiry IN THE DATABASE and only ever touch the one row that owns the
 * token — this app code cannot reach another video.
 *
 * The vote lands in `client_review_status`. Since v2.95 it also DRIVES the
 * pipeline (`autopostOnClientVote`): approving publishes the video to Metricool
 * on its planned date, rejecting sends it back to the editor. The old
 * "staff firewall" — where a human had to re-approve internally — is gone by
 * product decision; the guards now live in `decideClientVote` + `ideaPostReadiness`.
 */

/** Record the client's Aprobar / Rechazar decision. */
export async function submitClientReviewAction(
  token: string,
  decision: string,
  name: string,
): Promise<ClientActionResult> {
  const normalized = normalizeDecision(decision)
  if (!normalized) return { error: 'Decisión inválida.' }

  const supabase = createPublicClient()
  if (!supabase) return { error: 'No se pudo conectar. Intenta más tarde.' }

  const { data, error } = await supabase.rpc('submit_client_review', {
    p_token: token,
    p_decision: normalized,
    p_name: name ?? '',
  })
  if (error) return { error: 'No se pudo guardar tu decisión. El link puede haber vencido.' }

  const res = (data ?? {}) as {
    ok?: boolean
    error?: string
    status?: string
    idea_id?: string
    changed?: boolean
  }
  if (!res.ok) return { error: res.error ?? 'No se pudo guardar tu decisión.' }

  if (res.idea_id) {
    // Only notify when the vote actually CHANGED — a token holder re-submitting
    // the same decision must not flood the staff bell (mirrors the DB dedupe).
    if (res.changed) {
      await notifyStaffOfClientReview(res.idea_id, normalized, { reviewerName: name })
    }
    // But always re-run the pipeline hook on an approval, even when the vote
    // didn't change: if the first attempt failed to publish (Metricool down,
    // caption missing), a re-click is the client's only way to retry — and the
    // DB only reports `changed: false` on a re-approve. This is safe to repeat:
    // `decideClientVote` no-ops on an already-approved idea and the atomic claim
    // on `posting_started_at` makes a double-post impossible.
    if (res.changed || normalized === 'approved') {
      await autopostOnClientVote(res.idea_id)
    }
  }
  revalidatePath(`/review/${token}`)
  return { ok: true, status: res.status }
}

/** Add a client comment to the review thread. */
export async function addClientReviewCommentAction(
  token: string,
  name: string,
  body: string,
): Promise<ClientActionResult> {
  if (!body || body.trim().length === 0) return { error: 'Escribe un comentario.' }

  const supabase = createPublicClient()
  if (!supabase) return { error: 'No se pudo conectar. Intenta más tarde.' }

  const { data, error } = await supabase.rpc('add_client_review_comment', {
    p_token: token,
    p_name: name ?? '',
    p_body: body,
  })
  if (error) return { error: 'No se pudo enviar el comentario. El link puede haber vencido.' }

  const res = (data ?? {}) as { ok?: boolean; error?: string; idea_id?: string }
  if (!res.ok) return { error: res.error ?? 'No se pudo enviar el comentario.' }

  if (res.idea_id) {
    await notifyStaffOfClientReview(res.idea_id, 'comment', { reviewerName: name, commentBody: body })
  }
  revalidatePath(`/review/${token}`)
  return { ok: true }
}
