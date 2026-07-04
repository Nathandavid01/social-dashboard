import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildReviewNotification,
  resolveNotifyTargets,
  buildReviewNotificationRows,
  type ReviewNotifyEvent,
} from '@/lib/utils/review-notify-core'

/**
 * Notify the staff that a client acted on a review link — surfaces in the
 * existing notification bell. Targets the video's assignee + owners/supervisors.
 *
 * Called from the UNAUTHENTICATED client actions, so it uses the admin client
 * (service-role, server-side only) to insert notifications for other users —
 * the anon client can't. Best-effort: any failure is swallowed so it NEVER
 * breaks the client's vote/comment. No-op if service-role isn't configured.
 */
export async function notifyStaffOfClientReview(
  ideaId: string,
  event: ReviewNotifyEvent,
  opts: { reviewerName?: string | null; commentBody?: string | null } = {},
): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return

    const { data: idea } = await admin
      .from('content_ideas')
      .select('title, production_task_id, client:clients(name)')
      .eq('id', ideaId)
      .single()
    if (!idea) return

    let assigneeId: string | null = null
    if (idea.production_task_id) {
      const { data: task } = await admin
        .from('production_tasks')
        .select('assigned_to_id')
        .eq('id', idea.production_task_id)
        .single()
      assigneeId = (task?.assigned_to_id as string | null) ?? null
    }

    const { data: staff } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['owner', 'supervisor'])
    const staffIds = (staff ?? []).map((s) => s.id as string)

    const targets = resolveNotifyTargets({ assigneeId, staffIds })
    if (targets.length === 0) return

    const clientName = (idea.client as { name?: string } | null)?.name ?? 'El cliente'
    const notif = buildReviewNotification({
      event,
      clientName,
      videoTitle: idea.title as string | null,
      reviewerName: opts.reviewerName,
      commentBody: opts.commentBody,
    })
    const rows = buildReviewNotificationRows(targets, notif, `/produccion/idea/${ideaId}`, {
      idea_id: ideaId,
    })

    await admin.from('notifications').insert(rows)
  } catch {
    // best-effort — never block the client's action
  }
}
