'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { ContentIdeaType } from '@/lib/supabase/types'

/**
 * Bulk-place clients on the Content Pipeline board. A client appears on the
 * board once it has an active content_idea, so for each selected client we
 * create a starter card in the Idea column — the team then fills the batch.
 * Gated by planning.intake (same as the recorded-video intake).
 */
export async function addClientsToPipeline(input: {
  clientIds: string[]
  contentType?: ContentIdeaType
}): Promise<{ created?: number; error?: string }> {
  try {
    await requirePermission('planning.intake')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clientIds = Array.from(new Set((input.clientIds ?? []).map((c) => (c ?? '').trim()).filter(Boolean)))
  if (clientIds.length === 0) return { error: 'Selecciona al menos un cliente.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rows = clientIds.map((client_id) => ({
    client_id,
    content_type: input.contentType ?? 'R',
    title: 'Nuevo lote',
    status: 'idea' as const,
    created_by: user?.id ?? null,
  }))

  const { error } = await supabase.from('content_ideas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  revalidatePath('/planning')
  return { created: rows.length }
}
