'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { IdeaRowPayload } from '@/lib/ideas/batch-entry'

/**
 * Guardar un lote de ideas escritas a mano — lo que antes era el PDF.
 *
 * Entran como content_ideas normales en estado 'idea', sin sesión de grabación:
 * On Site las recoge desde ahí. Una tabla propia para "ideas escritas" habría
 * dado dos sitios donde vive una idea.
 */
export async function createIdeasBatch(input: {
  clientId: string
  rows: IdeaRowPayload[]
}): Promise<{ ok?: true; created?: number; error?: string }> {
  try {
    await requirePermission('ideas.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!input.clientId) return { error: 'Falta el cliente' }
  if (input.rows.length === 0) return { error: 'No hay ideas escritas' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert(input.rows.map((r) => ({
      client_id: input.clientId,
      content_type: r.contentType,
      title: r.title,
      hook: r.hook,
      shot_type: r.shotType,
      reference_url: r.referenceUrl,
      status: 'idea',
      created_by: user?.id ?? null,
    })))
    .select('id')

  if (error) return { error: error.message }

  // On Site las ofrece para añadir a una sesión, y el resto de pantallas de
  // ideas las lista: sin esto habría que recargar a mano para verlas.
  revalidatePath('/escribir-ideas')
  revalidatePath('/onsite')
  revalidatePath('/ideas-aprobadas')
  return { ok: true, created: data?.length ?? 0 }
}

export interface WrittenIdea {
  id: string
  title: string
  hook: string | null
  contentType: string
  shotType: string | null
  referenceUrl: string | null
  status: string
  createdAt: string
}

/** Lo ya escrito para este cliente y aún sin grabar, para no repetir ideas. */
export async function getWrittenIdeas(
  clientId: string,
): Promise<{ ideas?: WrittenIdea[]; error?: string }> {
  try {
    await requirePermission('ideas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, title, hook, content_type, shot_type, reference_url, status, created_at')
    .eq('client_id', clientId)
    .in('status', ['idea', 'asignada'])
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return { error: error.message }

  return {
    ideas: (data ?? []).map((i) => ({
      id: i.id,
      title: i.title ?? 'Sin título',
      hook: i.hook,
      contentType: i.content_type,
      shotType: (i.shot_type as string | null) ?? null,
      referenceUrl: (i.reference_url as string | null) ?? null,
      status: i.status,
      createdAt: i.created_at,
    })),
  }
}

/** Descartar una idea escrita. No borra: la deja fuera de los tableros. */
export async function discardWrittenIdea(ideaId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('ideas.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ status: 'descartada' })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  revalidatePath('/escribir-ideas')
  revalidatePath('/onsite')
  return { ok: true }
}
