'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'

/** Eric 2026-10-19: remove a pending piece from the calendar; it stays in Recibo and stops counting. */
export async function setReciboCalendarHidden(input: { ideaId: string; clientId: string; hidden: boolean }): Promise<{ ok?: true; error?: string }> {
  try { await requirePermission('posting.calendar.hide') } catch { return { error: 'No autorizado para quitar contenido del calendario.' } }
  if (!input || typeof input.ideaId !== 'string' || !input.ideaId || typeof input.clientId !== 'string' || !input.clientId || typeof input.hidden !== 'boolean') return { error: 'Faltan datos del contenido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('content_ideas').update({ calendar_hidden_at: input.hidden ? new Date().toISOString() : null }).eq('id', input.ideaId).eq('client_id', input.clientId).select('id')
  if (error) return { error: /calendar_hidden_at/.test(error.message) ? 'Falta aplicar la migración 0091 en la base de datos.' : 'No se pudo guardar el cambio.' }
  if (!data?.length) return { error: 'No se encontró el contenido de este cliente.' }
  try { for (const path of ['/recibo', `/clients/${input.clientId}/calendar`]) revalidatePath(path) } catch { /* The write is already saved. */ }
  return { ok: true }
}
