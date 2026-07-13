/**
 * Pure decision core for "the client's vote publishes by itself".
 *
 * Product rule (Eric, 2026-07-13): when the client approves from their review
 * link, the video is approved internally AND scheduled to Metricool — no human
 * in between. When they reject, it goes back to the editor's queue.
 *
 * This file holds ONLY the decision. The privileged DB writes + the Metricool
 * call live in `lib/actions/review-autopost.ts`, so every branch below is
 * unit-testable without Supabase or the network.
 *
 * The vote is re-read FROM THE DATABASE before this runs — never trusted from
 * the request — so a forged input can't drive an approval.
 */

export type ClientReviewStatus = 'pending' | 'approved' | 'rejected' | null
export type ApprovalStatus = 'pending' | 'submitted' | 'approved' | 'revision_needed' | null

export interface ClientVoteState {
  /** The vote as stored in `content_ideas.client_review_status`. */
  clientReviewStatus: ClientReviewStatus
  /** The internal `content_ideas.approval_status`. */
  approvalStatus: ApprovalStatus
}

export interface ClientVoteDecision {
  /** Promote `approval_status` to 'approved' (the client's yes IS the approval). */
  approve: boolean
  /** Send it back to the editor as 'revision_needed'. */
  requestRevision: boolean
  /** Attempt the Metricool auto-post after approving. */
  post: boolean
  /** Why nothing happened — for logs and staff-facing copy. */
  reason?: string
}

const NOOP = (reason: string): ClientVoteDecision => ({
  approve: false,
  requestRevision: false,
  post: false,
  reason,
})

/**
 * Decide what a client's vote should do to the video.
 *
 * Guards, in order:
 *  - Only a real 'approved' / 'rejected' vote acts; 'pending' is a no-op.
 *  - An ALREADY-approved video is never re-approved and never re-posted here
 *    (the posting layer has its own idempotency claim, but we don't even knock).
 *  - We only act on a video the staff actually PUT in front of the client:
 *    'submitted' (link sent) or 'revision_needed' (they rejected it, and the
 *    portal lets them change their mind — that re-approval must publish, not
 *    dead-end silently). A video still in 'pending' was never sent for review,
 *    so a stray vote on an old link must not publish anything.
 *
 * Note we deliberately do NOT check caption / edited video / blog_id here:
 * `ideaPostReadiness` owns that and refuses with a precise reason. Duplicating
 * it would let the two drift apart.
 */
const CLIENT_HOLDS_IT: ApprovalStatus[] = ['submitted', 'revision_needed']

export function decideClientVote(state: ClientVoteState): ClientVoteDecision {
  const { clientReviewStatus, approvalStatus } = state

  if (clientReviewStatus !== 'approved' && clientReviewStatus !== 'rejected') {
    return NOOP('El cliente aún no ha votado')
  }

  if (approvalStatus === 'approved') {
    return NOOP('El video ya estaba aprobado')
  }

  if (!CLIENT_HOLDS_IT.includes(approvalStatus)) {
    return NOOP('El video no está en revisión del cliente')
  }

  if (clientReviewStatus === 'rejected') {
    // Already back with the editor — don't re-bounce it (and don't re-log).
    if (approvalStatus === 'revision_needed') return NOOP('El video ya está con el editor')
    return { approve: false, requestRevision: true, post: false }
  }

  return { approve: true, requestRevision: false, post: true }
}
