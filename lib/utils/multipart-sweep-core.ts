/**
 * Pure decision logic for the multipart-upload sweep cron
 * (app/api/cron/multipart-sweep/route.ts). Closing a tab mid-upload leaves
 * an incomplete multipart in R2 with nothing client-side to clean it up —
 * this is the "how stale is too stale" rule, kept separate from the AWS SDK
 * calls so it's trivially unit-testable.
 */

/** Generous vs. even a very slow 5 GB upload on bad wifi — real uploads finish in minutes, not a day. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function isStaleMultipart(initiatedAt: Date | undefined, now: Date, staleAfterMs = STALE_AFTER_MS): boolean {
  if (!initiatedAt) return false
  return now.getTime() - initiatedAt.getTime() > staleAfterMs
}

/** ISO cutoff for "created_by row older than this is safe to drop" (multipart_uploads ownership table). */
export function staleCutoffISO(now: Date, staleAfterMs = STALE_AFTER_MS): string {
  return new Date(now.getTime() - staleAfterMs).toISOString()
}
