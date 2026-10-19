import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { deleteScheduledPost, getServerConfig } from '@/lib/metricool/post'
import { getScheduledPost } from '@/lib/metricool/scheduler'
import { assertDeletableDraft, type EditableCalendarPost } from '@/lib/metricool/calendar-state'
import { applyCalendarState } from '@/lib/metricool/calendar-state-apply'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
const revalidateCalendar = () => { try { for (const path of ['/mi-dia', '/published', '/calendar', '/pool', '/recibo', '/produccion']) revalidatePath(path) } catch { /* Response remains truthful even if route invalidation is unavailable. */ } }
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Origen de solicitud inválido.' }, 403)
  let input: { clientId: string; blogId: string; postId: number; uuid: string; action: 'draft' | 'schedule' | 'delete'; dateTime?: string; expected: { draft: boolean; publicationDate: string; text: string; timezone?: string } }
  try { input = await req.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  if (!input || !['draft', 'schedule', 'delete'].includes(input.action) || typeof input.clientId !== 'string' || !input.clientId || typeof input.blogId !== 'string' || !input.blogId || !Number.isSafeInteger(input.postId) || input.postId <= 0 || typeof input.uuid !== 'string' || !input.uuid || !input.expected || typeof input.expected.draft !== 'boolean' || typeof input.expected.text !== 'string' || typeof input.expected.publicationDate !== 'string') return json({ error: 'Falta identificar el post y su estado actual.' }, 400)
  if (!await currentUserHas('metricool.write') || (input.action === 'schedule' && !await currentUserHas('posting.publish')) || (input.action === 'delete' && !await currentUserHas('posting.calendar.delete_draft'))) return json({ error: 'No tienes permiso para cambiar esta publicación.' }, 403)
  const config = getServerConfig()
  if (!config) return json({ error: 'Metricool no está configurado.' }, 503)
  const db = await createClient()
  const { data: client, error: clientError } = await db.from('clients').select('id, name, metricool_blog_id').eq('id', input.clientId).eq('status', 'active').single()
  if (clientError || !client || client.metricool_blog_id !== input.blogId) return json({ error: 'El post no pertenece a una cuenta disponible de este cliente.' }, 403)
  const account = { ...config, blogId: input.blogId }
  let original
  try { original = await getScheduledPost(account, input.postId) } catch { return json({ error: 'No se pudo leer el post actual en Metricool. Verifica el calendario antes de cambiarlo.' }, 502) }
  if (original.uuid !== input.uuid || original.draft !== input.expected.draft || (original.text || '') !== input.expected.text || original.publicationDate.dateTime !== input.expected.publicationDate || (input.expected.timezone && original.publicationDate.timezone !== input.expected.timezone)) return json({ error: 'El post cambió en Metricool. Actualiza el calendario antes de modificarlo.' }, 409)
  if (input.action === 'delete') return deleteDraft(db, account, input.clientId, original)
  const applied = await applyCalendarState(db, account, input.clientId, original, input.action, input.dateTime)
  if (applied.status === 200) revalidateCalendar()
  return json(applied.body, applied.status)
}

async function deleteDraft(db: Awaited<ReturnType<typeof createClient>>, account: Parameters<typeof getScheduledPost>[0], clientId: string, original: EditableCalendarPost) {
  try { assertDeletableDraft(original) } catch (error) { return json({ error: error instanceof Error ? error.message : 'No se puede eliminar este post.' }, 409) }
  try { await deleteScheduledPost(original.id, account.blogId) } catch (error) {
    if (error instanceof Error && ('unsupportedDelete' in error || 'definitelyNotCreated' in error)) return json({ error: 'Metricool no permitió eliminar este borrador. Sigue guardado como borrador.' }, 409)
    // A timeout may occur after Metricool deleted the post: only a 404 on read-back proves it is gone.
    if (!await confirmedGone(account, original.id)) return json({ error: 'No se pudo confirmar que el borrador se eliminó. Verifica el calendario antes de intentarlo nuevamente.', uncertain: true }, 502)
  }
  let warning: string | undefined
  try {
    const { data: linked, error } = await db.from('content_ideas').update({ metricool_post_id: null, metricool_uuid: null, posted_at: null, posting_started_at: null }).eq('client_id', clientId).or(`metricool_post_id.eq.${original.id},metricool_uuid.eq.${JSON.stringify(original.uuid)}`).select('id')
    if (error) throw error
    if (linked?.length) {
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const { error: auditError } = await db.from('content_idea_activity').insert(linked.map(idea => ({
          content_idea_id: idea.id,
          client_id: clientId,
          user_id: user.id,
          action: 'posted_to_metricool',
          metadata: { source: 'posting_calendar', metricoolPostId: original.id, deleted: true, draft: true },
        })))
        if (auditError) warning = 'El borrador se eliminó en Metricool, pero no se pudo registrar en el historial del dashboard.'
      }
    }
  } catch { warning = 'El borrador se eliminó en Metricool, pero la idea del dashboard sigue enlazada y necesita revisión.' }
  revalidateCalendar()
  return json({ ok: true, confirmed: true, postId: original.id, uuid: original.uuid, action: 'delete', ...(warning ? { warning } : {}) })
}

async function confirmedGone(account: Parameters<typeof getScheduledPost>[0], postId: number) {
  try { await getScheduledPost(account, postId); return false } catch (error) { return error instanceof Error && /\b404\b/.test(error.message) }
}
