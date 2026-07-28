import { hasPermission } from '@/lib/auth/permissions'
import type { IdeaApprovalStatus, UserRole } from '@/lib/supabase/types'

/**
 * INTERNAL review — a teammate (supervisor/owner) watches the edited video and
 * either approves it or sends it back to the editor with changes. This is NOT
 * the client-facing approval in `review-link-core.ts`, which is a share link the
 * client opens; the two flows are deliberately separate and can both apply to
 * the same video at different points.
 *
 * Pure logic only, so the board, the card and the server action all agree on
 * who may act and what each decision does.
 */

export type ReviewDecision = 'approve' | 'request_changes' | 'submit'

export interface ReviewableVideo {
  approval_status: IdeaApprovalStatus
  /** Who sent it to review — nobody reviews their own work. */
  submitted_by?: string | null
}

/**
 * Can this user act as the reviewer on this video? Three gates, all required:
 * the role holds `video.approve`, the video is actually waiting, and the user
 * is not the person who submitted it.
 */
export function canReviewVideo(
  role: UserRole | null | undefined,
  video: ReviewableVideo,
  userId: string | null | undefined,
): boolean {
  if (!hasPermission(role, 'video.approve')) return false
  if (!isAwaitingReview(video)) return false
  // Self-review defeats the point of the stage — an approver must be a second pair
  // of eyes even when their role would otherwise allow it.
  if (video.submitted_by && userId && video.submitted_by === userId) return false
  return true
}

/** Only `submitted` videos sit in the reviewer's queue. */
export function isAwaitingReview(video: ReviewableVideo): boolean {
  return video.approval_status === 'submitted'
}

/**
 * The next approval_status for a decision, or null when the transition is not
 * legal from the current state (already approved, never submitted…). Returning
 * null rather than throwing lets callers treat it as a no-op + toast.
 */
export function applyReviewDecision(
  current: IdeaApprovalStatus,
  decision: ReviewDecision,
): IdeaApprovalStatus | null {
  if (decision === 'submit') {
    // The editor sends it in — first time, or again after fixing the changes.
    return current === 'pending' || current === 'revision_needed' ? 'submitted' : null
  }
  if (current !== 'submitted') return null
  return decision === 'approve' ? 'approved' : 'revision_needed'
}

export type ReviewTone = 'waiting' | 'warn' | 'done' | 'muted'

export interface ReviewState {
  key: IdeaApprovalStatus
  label: string
  tone: ReviewTone
}

/** The chip a board card shows for where it stands in internal review. */
export function reviewState(status: IdeaApprovalStatus): ReviewState {
  switch (status) {
    case 'submitted':
      return { key: 'submitted', label: 'En revisión', tone: 'waiting' }
    case 'revision_needed':
      return { key: 'revision_needed', label: 'Cambios pedidos', tone: 'warn' }
    case 'approved':
      return { key: 'approved', label: 'Aprobado', tone: 'done' }
    default:
      return { key: 'pending', label: 'Sin enviar', tone: 'muted' }
  }
}
