'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { rowsParaBorrador } from '@/lib/ideas/draft'
import type { IdeaRow } from '@/lib/ideas/batch-entry'

/**
 * Borradores de "Escribir ideas": lo tecleado y aún no enviado, por persona y
 * cliente. Ver `supabase/migrations/0059_idea_drafts.sql` para el porqué.
 *
 * No revalidan la ruta: guardar un borrador ocurre mientras se teclea y un
 * refresh en cada pulsación tiraría lo que se está escribiendo.
 */

/** Guarda (o borra, si ya no queda nada escrito) el borrador de este cliente. */
export async function saveIdeaDraft(input: {
  clientId: string
  rows: IdeaRow[]
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('ideas.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!input.clientId) return { error: 'Falta el cliente' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión' }

  const rows = rowsParaBorrador(input.rows ?? [])

  // Vaciar la tabla es borrar el borrador, no guardar uno vacío: si no, quedan
  // filas fantasma que reaparecen al volver al cliente.
  if (rows.length === 0) return deleteIdeaDraft(input.clientId)

  const { error } = await supabase
    .from('idea_drafts')
    .upsert(
      { user_id: user.id, client_id: input.clientId, rows, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,client_id' },
    )
  if (error) return { error: error.message }
  return { ok: true }
}

/** El borrador de esta persona para este cliente, o null si no hay. */
export async function getIdeaDraft(clientId: string): Promise<{ rows: IdeaRow[] | null; error?: string }> {
  try {
    await requirePermission('ideas.edit')
  } catch (err) {
    return { rows: null, error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!clientId) return { rows: null }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: null }

  const { data, error } = await supabase
    .from('idea_drafts')
    .select('rows')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) return { rows: null, error: error.message }
  return { rows: (data?.rows as IdeaRow[] | undefined) ?? null }
}

/** Se llama al enviar las ideas de verdad: lo enviado ya no es borrador. */
export async function deleteIdeaDraft(clientId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('ideas.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión' }

  const { error } = await supabase
    .from('idea_drafts')
    .delete()
    .eq('user_id', user.id)
    .eq('client_id', clientId)
  if (error) return { error: error.message }
  return { ok: true }
}
