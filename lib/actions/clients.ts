'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CADENCIA_TAG } from './cadencia-tag'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { assertOwner, requirePermission } from '@/lib/auth/server'
import { clientSchema } from '@/lib/validations/client.schema'
import type { ClientFormValues } from '@/lib/validations/client.schema'

export async function getClients(filters?: {
  status?: string
  platform?: string
  search?: string
}) {
  const supabase = await createSupabaseClient()

  let query = supabase
    .from('clients')
    .select('*, assignee:profiles!clients_assigned_to_fkey(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.platform) {
    query = query.contains('platforms', [filters.platform])
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getClientById(id: string) {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('clients')
    .select('*, assignee:profiles!clients_assigned_to_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createClient(values: ClientFormValues) {
  try {
    await requirePermission('clients.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createSupabaseClient()
  const parsed = clientSchema.safeParse(values)
  if (!parsed.success) return { error: 'Invalid form data' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidateTag(CADENCIA_TAG)
  revalidatePath('/clients')
  // Return the id so the onboarding wizard can keep configuring this client.
  return { success: true, id: created?.id as string | undefined }
}

export async function updateClient(id: string, values: ClientFormValues) {
  try {
    await requirePermission('clients.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createSupabaseClient()
  const parsed = clientSchema.safeParse(values)
  if (!parsed.success) return { error: 'Invalid form data' }

  const { error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidateTag(CADENCIA_TAG)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

/**
 * Pausar un cliente — la alternativa a borrarlo.
 *
 * Sale del flujo (cadencia, sync de Metricool, captions, plan semanal) pero
 * conserva su historial, sus ideas y sus videos. Borrar es definitivo: arrastra
 * en cascada las ideas —y con ellas los videos— y deja huérfanas las sesiones de
 * grabación, además de dejar los archivos en R2 sin nada que apunte a ellos.
 *
 * Reversible, así que basta con clients.edit; borrar sigue siendo de owner.
 */
export async function pauseClient(id: string) {
  try {
    await requirePermission('clients.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('clients')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateTag(CADENCIA_TAG)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/pipeline')
  return { success: true }
}

/** One-click "Activar cliente" from the onboarding checklist — flips status to
 *  active so the pipeline auto-provisions and auto-publish can fire. */
export async function activateClient(id: string) {
  try {
    await requirePermission('clients.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('clients')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateTag(CADENCIA_TAG)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/pipeline')
  return { success: true }
}

export async function deleteClient(id: string) {
  // Borrar un cliente arrastra payments, assets, ideas, tareas, sesiones —
  // operación destructiva, restringida a owner.
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createSupabaseClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidateTag(CADENCIA_TAG)
  revalidatePath('/clients')
  return { success: true }
}
