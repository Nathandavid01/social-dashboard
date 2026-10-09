import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getServerConfig, updateScheduledPost } from '@/lib/metricool/post'
import { getScheduledPost } from '@/lib/metricool/scheduler'
import { buildCalendarStateUpdate } from '@/lib/metricool/calendar-state'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Origen de solicitud inválido.' }, 403)
  let input: { clientId: string; blogId: string; postId: number; uuid: string; action: 'draft' | 'schedule'; dateTime?: string; expected: { draft: boolean; publicationDate: string; text: string; timezone?: string } }
  try { input = await req.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  if (!input || !['draft', 'schedule'].includes(input.action) || typeof input.clientId !== 'string' || !input.clientId || typeof input.blogId !== 'string' || !input.blogId || !Number.isSafeInteger(input.postId) || input.postId <= 0 || typeof input.uuid !== 'string' || !input.uuid || !input.expected || typeof input.expected.draft !== 'boolean' || typeof input.expected.text !== 'string' || typeof input.expected.publicationDate !== 'string') return json({ error: 'Falta identificar el post y su estado actual.' }, 400)
  if (!await currentUserHas('metricool.write') || (input.action === 'schedule' && !await currentUserHas('posting.publish'))) return json({ error: 'No tienes permiso para cambiar esta publicación.' }, 403)
  const config = getServerConfig()
  if (!config) return json({ error: 'Metricool no está configurado.' }, 503)
  const db = await createClient()
  const { data: client, error: clientError } = await db.from('clients').select('id, name, metricool_blog_id').eq('id', input.clientId).eq('status', 'active').single()
  if (clientError || !client || client.metricool_blog_id !== input.blogId) return json({ error: 'El post no pertenece a una cuenta disponible de este cliente.' }, 403)
  const account = { ...config, blogId: input.blogId }
  let original
  try { original = await getScheduledPost(account, input.postId) } catch { return json({ error: 'No se pudo leer el post actual en Metricool. Verifica el calendario antes de cambiarlo.' }, 502) }
  if (original.uuid !== input.uuid || original.draft !== input.expected.draft || (original.text || '') !== input.expected.text || original.publicationDate.dateTime !== input.expected.publicationDate || (input.expected.timezone && original.publicationDate.timezone !== input.expected.timezone)) return json({ error: 'El post cambió en Metricool. Actualiza el calendario antes de modificarlo.' }, 409)
  let update
  try { update = buildCalendarStateUpdate(original, input.action, input.dateTime) } catch (error) { return json({ error: error instanceof Error ? error.message : 'No se puede cambiar este post.' }, 409) }
  let result
  try { result = await updateScheduledPost(original.id, input.blogId, update) } catch {
    // A timeout may occur after Metricool accepted the PUT; never create/replay a post.
    return json({ error: 'No se pudo confirmar el cambio. Verifica Metricool antes de intentarlo nuevamente.', uncertain: true }, 502)
  }
  const postId = result.data?.id ?? original.id
  const uuid = result.data?.uuid ?? original.uuid
  let warning: string | undefined
  let linkedIdeas: { id: string }[] = []
  try {
    const { data: linked, error } = await db.from('content_ideas').update({ metricool_post_id: postId, metricool_uuid: uuid, ...(input.action === 'schedule' ? { publish_date: input.dateTime!.slice(0, 10) } : {}) }).eq('client_id', input.clientId).or(`metricool_post_id.eq.${original.id},metricool_uuid.eq.${JSON.stringify(original.uuid)}`).select('id')
    if (error) warning = 'Metricool aceptó el cambio, pero no se pudo actualizar la referencia del dashboard. No vuelvas a enviar el post.'
    else linkedIdeas = linked ?? []
  } catch { warning = 'Metricool aceptó el cambio; la referencia del dashboard necesita revisión.' }
  let confirmed = false
  try {
    const current = await getScheduledPost(account, postId)
    const date = update.publicationDate as { dateTime: string; timezone: string }
    confirmed = current.uuid === original.uuid && (current.text || '') === (original.text || '') && JSON.stringify(current.media) === JSON.stringify(original.media) && JSON.stringify(current.providers.map(p => p.network).sort()) === JSON.stringify(original.providers.map(p => p.network).sort()) && current.draft === update.draft && current.autoPublish === update.autoPublish && (input.action === 'draft' || (current.publicationDate.dateTime === date.dateTime && current.publicationDate.timezone === date.timezone))
  } catch { /* The write was accepted; report unverified rather than replaying it. */ }
  if (confirmed && linkedIdeas.length) {
    try {
      const { data: { user }, error: authError } = await db.auth.getUser()
      if (authError || !user) throw new Error('No se pudo identificar al usuario del cambio.')
      const { error: auditError } = await db.from('content_idea_activity').insert(linkedIdeas.map(idea => ({
        content_idea_id: idea.id,
        client_id: input.clientId,
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
  try { for (const path of ['/home', '/published', '/calendar', '/pool', '/recibo', '/produccion']) revalidatePath(path) } catch { /* Response remains truthful even if route invalidation is unavailable. */ }
  return json({ ok: true, confirmed, postId, uuid, action: input.action, ...(warning ? { warning } : {}) })
}
