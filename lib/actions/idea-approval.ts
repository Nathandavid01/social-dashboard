'use server'

import { decideReview, resubmitForReview } from '@/lib/actions/pipeline-submit'
import type { ReviewVerification } from '@/lib/utils/review-quality'

// Every entry point uses the same ownership, new-file and quality gates.
export async function submitIdeaForApproval(ideaId: string) {
  return resubmitForReview(ideaId)
}

export async function approveIdea(ideaId: string, videoFileId?: string | null, verification?: Omit<ReviewVerification, 'videoFileId'>) {
  return decideReview({ ideaId, decision: 'approve', videoFileId, ...verification })
}

export async function requestRevision(ideaId: string, note?: string) {
  return decideReview({ ideaId, decision: 'request_changes', note })
}
