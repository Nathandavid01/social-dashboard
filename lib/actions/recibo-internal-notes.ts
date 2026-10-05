'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

export type ReciboInternalNote = {
  id: string
  author_name: string
  body: string
  created_at: string
}

/** Staff-only Recibo thread. The client review portal must not see this. */
export async function listReciboInternalNotes(ideaId: string): Promise<ReciboInternalNote[]> {
  try {
    await requirePermission('entregas.read')
  } catch {
    return []
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('recibo_internal_notes')
    .select('id, author_name, body, created_at')
    .eq('content_idea_id', ideaId)
    .order('created_at', { ascending: true })

  return (data as ReciboInternalNote[]) ?? []
}

export async function addReciboInternalNote(
  ideaId: string,
  body: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('entregas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!body || body.trim().length === 0) return { error: 'Escribe un motivo.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('recibo_internal_notes').insert({
    content_idea_id: ideaId,
    author_id: user.id,
    author_name: profile?.full_name?.trim() || 'Equipo',
    body: body.trim(),
  })
  if (error) return { error: 'No se pudo guardar el motivo.' }

  revalidatePath('/recibo')
  return { ok: true }
}
