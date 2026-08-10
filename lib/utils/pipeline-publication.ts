/** Published videos stay on the pipeline board for this long before dropping off. */
export const PIPELINE_PUBLISHED_GRACE_MS = 24 * 60 * 60 * 1000

export type PublicationFields = {
  published_at?: string | null
  posted_at?: string | null
  status?: string | null
  approval_status?: string | null
}

export function isPublishedIdea(idea: PublicationFields): boolean {
  return !!idea.published_at || idea.status === 'publicada'
}

export function publishTimestampMs(idea: PublicationFields): number | null {
  if (idea.published_at) {
    const t = Date.parse(idea.published_at)
    if (!Number.isNaN(t)) return t
  }
  if (idea.posted_at) {
    const t = Date.parse(idea.posted_at)
    if (!Number.isNaN(t)) return t
  }
  return null
}

/** True when the video is live and still within the 24h board grace window. */
export function isRecentlyPublished(idea: PublicationFields, nowMs = Date.now()): boolean {
  if (!isPublishedIdea(idea)) return false
  const t = publishTimestampMs(idea)
  // No timestamp yet (sync pending) — keep visible until we know it's old.
  if (t == null) return true
  return nowMs - t < PIPELINE_PUBLISHED_GRACE_MS
}

/** Approved by the client, scheduled or ready — not live yet. */
export function isWaitingToPublish(idea: PublicationFields): boolean {
  return idea.approval_status === 'approved' && !isPublishedIdea(idea)
}

export function isPublicationStage(idea: PublicationFields, nowMs = Date.now()): boolean {
  return isWaitingToPublish(idea) || isRecentlyPublished(idea, nowMs)
}

/** Active pipeline rows: in-flight work, plus published videos for 24h only. */
export function isPipelineVisibleIdea(
  idea: PublicationFields & { status?: string | null },
  nowMs = Date.now(),
): boolean {
  if (idea.status === 'descartada') return false
  if (!isPublishedIdea(idea)) return true
  return isRecentlyPublished(idea, nowMs)
}
