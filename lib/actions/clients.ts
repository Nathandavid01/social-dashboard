'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
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
  const supabase = await createSupabaseClient()
  const parsed = clientSchema.safeParse(values)
  if (!parsed.success) return { error: 'Invalid form data' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('clients').insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { success: true }
}

export async function updateClient(id: string, values: ClientFormValues) {
  const supabase = await createSupabaseClient()
  const parsed = clientSchema.safeParse(values)
  if (!parsed.success) return { error: 'Invalid form data' }

  const { error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function deleteClient(id: string) {
  const supabase = await createSupabaseClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { success: true }
}
