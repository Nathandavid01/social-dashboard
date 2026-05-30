import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentIdeaVideoKind } from '@/lib/supabase/types'

/**
 * In-app notification when recording material lands: pings the client's
 * account manager (clients.assigned_to) — or all owners if the client is
 * unassigned — that a raw or edited video was uploaded, with a link to the
 * idea. The notification's own created_at IS the upload time, so the bell
 * shows exactly when it arrived.
 *
 * Best-effort: a failure here must never break the upload (mirrors
 * logIdeaActivity). b-roll is skipped — too noisy. Reuses existing
 * notification kinds (the bell renders its icon by `severity`, not `kind`),
 * so no migration / CHECK-constraint change is needed.
 */
export async function notifyVideoUploaded(
  supabase: SupabaseClient,
  params: { ideaId: string; kind: ContentIdeaVideoKind; uploaderId?: string | null },
): Promise<void> {
  if (params.kind !== 'raw' && params.kind !== 'edited') return
  try {
    const { data: idea } = await supabase
      .from('content_ideas')
      .select('title, client:clients(name, assigned_to)')
      .eq('id', params.ideaId)
      .single()
    if (!idea) return

    const clientRaw = (idea as { client?: unknown }).client
    const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as
      | { name?: string | null; assigned_to?: string | null }
      | undefined
    const clientName = client?.name ?? 'cliente'
    const title = (idea as { title?: string | null }).title ?? 'la idea'

    // Recipients: the assigned account manager, else every owner.
    let recipients: string[]
    if (client?.assigned_to) {
      recipients = [client.assigned_to]
    } else {
      const { data: owners } = await supabase.from('profiles').select('id').eq('role', 'owner')
      recipients = (owners ?? []).map((o: { id: string }) => o.id)
    }
    // Dedup + never ping the uploader about their own upload.
    recipients = Array.from(new Set(recipients)).filter((id) => id && id !== params.uploaderId)
    if (recipients.length === 0) return

    const isEdited = params.kind === 'edited'
    const rows = recipients.map((userId) => ({
      user_id: userId,
      kind: isEdited ? 'review_pending' : 'task_completed',
      title: `${isEdited ? '🎬 Video editado' : '🎥 Video crudo'} subido — ${clientName}`,
      body: isEdited
        ? `Versión final de "${title}" lista para revisar.`
        : `Material grabado de "${title}".`,
      link: `/produccion/idea/${params.ideaId}`,
      severity: 'info',
      meta: { source: 'video_uploaded', kind: params.kind, idea_id: params.ideaId },
    }))
    await supabase.from('notifications').insert(rows)
  } catch {
    /* non-blocking — notifications never break an upload */
  }
}
