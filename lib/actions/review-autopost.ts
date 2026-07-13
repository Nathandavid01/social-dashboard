import 'server-only'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { runIdeaPost } from '@/lib/actions/idea-posting-run'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import {
  decideClientVote,
  type ApprovalStatus,
  type ClientReviewStatus,
} from '@/lib/utils/client-vote-autopost-core'

/**
 * "The client's vote publishes by itself."
 *
 * Runs right after a client votes on `/review/<token>`. On approval it promotes
 * the video to `approved` and hands it to the SAME Metricool engine the manual
 * button uses; on rejection it drops it back to `revision_needed` so it lands in
 * the editor's queue.
 *
 * Privilege: the public review link is UNAUTHENTICATED, so this uses the
 * service-role client — the only way to write `approval_status` with no session.
 * Three things keep that safe:
 *   1. `server-only` + no `'use server'` → this is never an HTTP endpoint. It is
 *      reachable ONLY from `submitClientReviewAction`, after that action's RPC
 *      has already validated the token and expiry in the database.
 *   2. The vote is RE-READ from the row (not taken from the caller), so a forged
 *      argument cannot manufacture an approval.
 *   3. `decideClientVote` refuses to act on any video the staff didn't actually
 *      submit for review.
 *
 * Best-effort by construction: it NEVER throws. The client's vote is already
 * committed by the time we get here, and a Metricool outage must not turn their
 * "Aprobado" into an error screen.
 */

const KILL_SWITCH = process.env.METRICOOL_AUTOPOST_ON_APPROVAL === 'false'

export type ClientVoteAutopostOutcome =
  | { acted: false; reason: string }
  | { acted: true; approved: boolean; revisionRequested: boolean; posted: boolean; skipped?: string }

export async function autopostOnClientVote(ideaId: string): Promise<ClientVoteAutopostOutcome> {
  try {
    const supabase = createAdminClient()
    if (!supabase) return { acted: false, reason: 'Service role no configurado' }

    // Source of truth: the vote as the DB recorded it, never the caller's word.
    const { data: idea, error } = await supabase
      .from('content_ideas')
      .select('id, approval_status, client_review_status')
      .eq('id', ideaId)
      .single()
    if (error || !idea) return { acted: false, reason: 'Idea no encontrada' }

    const decision = decideClientVote({
      clientReviewStatus: (idea.client_review_status ?? null) as ClientReviewStatus,
      approvalStatus: (idea.approval_status ?? null) as ApprovalStatus,
    })

    if (decision.requestRevision) {
      const { error: updErr } = await supabase
        .from('content_ideas')
        .update({ approval_status: 'revision_needed' })
        .eq('id', ideaId)
      if (updErr) return { acted: false, reason: updErr.message }

      await logIdeaActivity(supabase, {
        ideaId,
        userId: null,
        action: 'client_requested_changes',
        metadata: { source: 'review_link' },
      })
      revalidateStaffViews(ideaId)
      return { acted: true, approved: false, revisionRequested: true, posted: false }
    }

    if (!decision.approve) return { acted: false, reason: decision.reason ?? 'Sin acción' }

    // The client's yes IS the internal approval. `approved_by` stays null — that
    // column is a profiles FK and the approver here is the client, not a user;
    // the activity log below is what records who really approved it.
    const { error: updErr } = await supabase
      .from('content_ideas')
      .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', ideaId)
      .eq('approval_status', 'submitted') // guard the race: only the submitted row
    if (updErr) return { acted: false, reason: updErr.message }

    await logIdeaActivity(supabase, {
      ideaId,
      userId: null,
      action: 'approved_by_client',
      metadata: { source: 'review_link' },
    })

    if (!decision.post || KILL_SWITCH) {
      revalidateStaffViews(ideaId)
      return { acted: true, approved: true, revisionRequested: false, posted: false, skipped: 'Auto-post desactivado' }
    }

    // Same engine as the manual button — including the atomic claim that makes
    // double-posting impossible if a staffer hits Publicar at the same moment.
    const res = await runIdeaPost(supabase, ideaId, null)
    revalidateStaffViews(ideaId)

    if (res.error) {
      return { acted: true, approved: true, revisionRequested: false, posted: false, skipped: res.error }
    }
    if (res.skipped) {
      return { acted: true, approved: true, revisionRequested: false, posted: false, skipped: res.skipped }
    }
    return { acted: true, approved: true, revisionRequested: false, posted: true }
  } catch (err) {
    // Never let this break the client's vote — it is already saved.
    console.error('[review-autopost] failed for', ideaId, err)
    return { acted: false, reason: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

function revalidateStaffViews(ideaId: string) {
  revalidatePath('/pipeline')
  revalidatePath('/video-reviews')
  revalidatePath(`/produccion/idea/${ideaId}`)
}
