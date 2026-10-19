import { updateScheduledPost } from '@/lib/metricool/post'
import { getScheduledPost } from '@/lib/metricool/scheduler'
import { buildCalendarStateUpdate, type EditableCalendarPost } from '@/lib/metricool/calendar-state'
import type { createClient } from '@/lib/supabase/server'

type Db = Awaited<ReturnType<typeof createClient>>
type Account = Parameters<typeof getScheduledPost>[0] & { blogId: string }
export type CalendarStateApplied =
  | { status: 200; body: { ok: true; confirmed: boolean; postId: number; uuid: string; action: 'draft' | 'schedule'; warning?: string } }
  | { status: 409 | 502; body: { error: string; uncertain?: true } }

/**
 * Turns an already-read Metricool post into a draft or a scheduled post, then verifies it by read-back.
 * Shared by the calendar route and the Recibo «Enviar» action so both keep the same safeguards.
 */
export async function applyCalendarState(db: Db, account: Account, clientId: string, original: EditableCalendarPost, action: 'draft' | 'schedule', dateTime?: string): Promise<CalendarStateApplied> {
  let update
  try { update = buildCalendarStateUpdate(original, action, dateTime) } catch (error) { return { status: 409, body: { error: error instanceof Error ? error.message : 'No se puede cambiar este post.' } } }
  let result
  try { result = await updateScheduledPost(original.id, account.blogId, update) } catch {
    // A timeout may occur after Metricool accepted the PUT; never create/replay a post.
    return { status: 502, body: { error: 'No se pudo confirmar el cambio. Verifica Metricool antes de intentarlo nuevamente.', uncertain: true } }
  }
  const postId = result.data?.id ?? original.id
  const uuid = result.data?.uuid ?? original.uuid
  let warning: string | undefined
  let linkedIdeas: { id: string }[] = []
  try {
    const { data: linked, error } = await db.from('content_ideas').update({ metricool_post_id: postId, metricool_uuid: uuid, ...(action === 'schedule' ? { publish_date: dateTime!.slice(0, 10) } : {}) }).eq('client_id', clientId).or(`metricool_post_id.eq.${original.id},metricool_uuid.eq.${JSON.stringify(original.uuid)}`).select('id')
    if (error) warning = 'Metricool aceptó el cambio, pero no se pudo actualizar la referencia del dashboard. No vuelvas a enviar el post.'
    else linkedIdeas = linked ?? []
  } catch { warning = 'Metricool aceptó el cambio; la referencia del dashboard necesita revisión.' }
  let confirmed = false
  try {
    const current = await getScheduledPost(account, postId)
    const date = update.publicationDate as { dateTime: string; timezone: string }
    confirmed = current.uuid === original.uuid && (current.text || '') === (original.text || '') && JSON.stringify(current.media) === JSON.stringify(original.media) && JSON.stringify(current.providers.map(p => p.network).sort()) === JSON.stringify(original.providers.map(p => p.network).sort()) && current.draft === update.draft && current.autoPublish === update.autoPublish && (action === 'draft' || (current.publicationDate.dateTime === date.dateTime && current.publicationDate.timezone === date.timezone))
  } catch { /* The write was accepted; report unverified rather than replaying it. */ }
  if (confirmed && linkedIdeas.length) {
    try {
      const { data: { user }, error: authError } = await db.auth.getUser()
      if (authError || !user) throw new Error('No se pudo identificar al usuario del cambio.')
      const { error: auditError } = await db.from('content_idea_activity').insert(linkedIdeas.map(idea => ({
        content_idea_id: idea.id,
        client_id: clientId,
        user_id: user.id,
        action: 'posted_to_metricool',
        metadata: {
          source: 'posting_calendar',
          metricoolPostId: postId,
          previousMetricoolPostId: original.id,
          scheduledFor: (update.publicationDate as { dateTime: string }).dateTime,
          platforms: original.providers.map(provider => provider.network),
          draft: update.draft,
          autoPublish: update.autoPublish,
        },
      })))
      if (auditError) throw auditError
    } catch {
      warning = [warning, 'El cambio está confirmado en Metricool, pero no se pudo actualizar el historial del dashboard. Su indicador de borrador necesita revisión.'].filter(Boolean).join(' ')
    }
  }
  if (!confirmed) warning = [warning, 'Metricool aceptó el cambio, pero todavía no se pudo verificar. Actualiza el calendario antes de repetir la acción.'].filter(Boolean).join(' ')
  return { status: 200, body: { ok: true, confirmed, postId, uuid, action, ...(warning ? { warning } : {}) } }
}
