'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { createContentIdeaManual, saveContentIdea } from '@/lib/actions/content-ideas'
import {
  CLIENT_BROLL_THEME,
  clientBrollLibraryTitle,
  ideaTitleFromUpload,
} from '@/lib/pipeline/banco-direct-upload'

/**
 * Crea una idea para pegarle crudos desde /banco, sin sesión de grabación.
 * El video se sube después con el motor existente (startUpload → registerR2Video).
 */
export async function createBankIdea(input: {
  clientId: string
  title: string
}): Promise<{ ideaId?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clientId = input.clientId.trim()
  const title = ideaTitleFromUpload(input.title, [])
  if (!clientId) return { error: 'Elige un cliente' }
  if (!title) return { error: 'Ponle un título a la idea' }

  const result = await createContentIdeaManual({
    clientId,
    contentType: 'R',
    title,
  })
  if ('error' in result) return { error: result.error }
  if (!result.idea) return { error: 'No se pudo crear la idea' }

  revalidatePath('/banco')
  return { ideaId: result.idea.id }
}

/**
 * Idea sentinela del cliente: ahí vive el B-roll permanente.
 * Se reusa si ya existe; no se ata a una grabación.
 */
export async function ensureClientBrollLibrary(input: {
  clientId: string
  clientName: string
}): Promise<{ ideaId?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clientId = input.clientId.trim()
  if (!clientId) return { error: 'Elige un cliente' }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('content_ideas')
    .select('id')
    .eq('client_id', clientId)
    .eq('theme', CLIENT_BROLL_THEME)
    .neq('status', 'descartada')
    .maybeSingle()
  if (existing?.id) return { ideaId: existing.id }

  const result = await saveContentIdea({
    clientId,
    contentType: 'R',
    title: clientBrollLibraryTitle(input.clientName),
    theme: CLIENT_BROLL_THEME,
  })
  if ('error' in result) return { error: result.error }
  if (!result.idea) return { error: 'No se pudo crear el B-roll del cliente' }

  revalidatePath('/banco')
  return { ideaId: result.idea.id }
}
