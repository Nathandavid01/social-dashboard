/**
 * Pure, network-free copy builder for the "client reviewed a video" staff
 * notifications (shown in the existing notification bell). Given the event +
 * client/video context, it returns the notification kind/title/body/severity in
 * Spanish. The staff-facing text lives here so it's unit-tested and consistent.
 */

export type ReviewNotifyEvent = 'approved' | 'rejected' | 'comment'

export type ReviewNotification = {
  kind: 'review_approved' | 'review_rejected' | 'client_message'
  title: string
  body: string
  severity: 'success' | 'warning' | 'info'
}

/** Trim to a short preview for the notification body (comments can be long). */
function preview(text: string, max = 100): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Deduped, non-empty set of user ids to notify: the video's assignee (if any)
 * plus the standing staff list (owners/supervisors). */
export function resolveNotifyTargets(input: {
  assigneeId?: string | null
  staffIds: string[]
}): string[] {
  const set = new Set<string>()
  if (input.assigneeId) set.add(input.assigneeId)
  for (const id of input.staffIds) if (id) set.add(id)
  return Array.from(set)
}

/** One notification insert row per target, sharing the built copy + link + meta. */
export function buildReviewNotificationRows(
  targets: string[],
  notif: ReviewNotification,
  link: string,
  meta: Record<string, unknown>,
): Array<{
  user_id: string
  kind: ReviewNotification['kind']
  title: string
  body: string
  link: string
  severity: ReviewNotification['severity']
  meta: Record<string, unknown>
}> {
  return targets.map((user_id) => ({
    user_id,
    kind: notif.kind,
    title: notif.title,
    body: notif.body,
    link,
    severity: notif.severity,
    meta,
  }))
}

export function buildReviewNotification(input: {
  event: ReviewNotifyEvent
  clientName: string
  videoTitle?: string | null
  reviewerName?: string | null
  commentBody?: string | null
}): ReviewNotification {
  const client = input.clientName.trim() || 'El cliente'
  const video = input.videoTitle?.trim() || 'un video'
  const who = input.reviewerName?.trim()

  switch (input.event) {
    case 'approved':
      return {
        kind: 'review_approved',
        title: `${client} aprobó un video`,
        body: `"${video}"${who ? ` · ${who}` : ''}`,
        severity: 'success',
      }
    case 'rejected':
      return {
        kind: 'review_rejected',
        title: `${client} pidió cambios`,
        body: `"${video}"${who ? ` · ${who}` : ''}`,
        severity: 'warning',
      }
    case 'comment':
      return {
        kind: 'client_message',
        title: `${client} comentó un video`,
        body: input.commentBody?.trim()
          ? `${who ? `${who}: ` : ''}${preview(input.commentBody)}`
          : `"${video}"`,
        severity: 'info',
      }
  }
}
