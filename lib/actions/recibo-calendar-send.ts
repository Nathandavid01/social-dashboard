'use server'

import { revalidatePath } from 'next/cache'
import { currentUserHas, requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPost } from '@/lib/metricool/scheduler'
import { applyCalendarState } from '@/lib/metricool/calendar-state-apply'
import { draftReciboOnDate } from './recibo-calendar-draft'

export type SendReciboResult = { ok?: true; confirmed?: boolean; scheduledFor?: string; warning?: string; error?: string; draftOnly?: true; uncertain?: true }

/**
 * Eric 2026-10-19: «quiero poder enviar desde aquí». An explicit, confirmed «Enviar» on a pending card
 * creates the draft through every Recibo guard, then schedules that same post at its own date and slot time.
 * If scheduling fails the draft stays; it is never replayed or recreated.
 */
export async function sendReciboOnDate(input: { ideaId: string; clientId: string; videoId: string; date: string }): Promise<SendReciboResult> {
  try { await requirePermission('posting.publish') } catch { return { error: 'No autorizado para programar publicaciones.' } }
  if (!await currentUserHas('metricool.write')) return { error: 'No autorizado para cambiar publicaciones en Metricool.' }
  const draft = await draftReciboOnDate(input)
  if (!draft.ok) return { error: draft.error || 'No se confirmó el borrador. Verifica Metricool antes de reenviar.' }
  const keepDraft = (why: string): SendReciboResult => ({ draftOnly: true, error: `Se creó el borrador, pero no se programó: ${why} Prográmalo desde el borrador en el calendario.` })
  if (!draft.postId) return keepDraft('Metricool no devolvió su identificador.')
  const config = getServerConfig()
  if (!config) return keepDraft('Metricool no está configurado.')
  const db = await createClient()
  const { data: client } = await db.from('clients').select('id, metricool_blog_id').eq('id', input.clientId).eq('status', 'active').single()
  const blogId = (client as { metricool_blog_id?: string | null } | null)?.metricool_blog_id?.trim()
  if (!blogId) return keepDraft('el cliente no tiene cuenta de Metricool.')
  const account = { ...config, blogId }
  let original
  try { original = await getScheduledPost(account, draft.postId) } catch { return keepDraft('no se pudo leer el borrador en Metricool.') }
  const dateTime = original.publicationDate.dateTime.slice(0, 16)
  const applied = await applyCalendarState(db, account, input.clientId, original, 'schedule', dateTime)
  try { for (const path of ['/recibo', '/published', '/calendar', `/clients/${input.clientId}/calendar`]) revalidatePath(path) } catch { /* Result stays truthful. */ }
  if (applied.status !== 200) return applied.body.uncertain ? { uncertain: true, error: applied.body.error } : keepDraft(applied.body.error)
  return { ok: true, confirmed: applied.body.confirmed, scheduledFor: dateTime, ...(applied.body.warning ? { warning: applied.body.warning } : {}) }
}
