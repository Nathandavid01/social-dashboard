'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getAlerts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data, error, count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).limit(5000)

  if (error) throw new Error(error.message)
  if ((count ?? 0) > (data?.length ?? 0) || (data?.length ?? 0) >= 5000) throw new Error('Consulta de alertas incompleta. No se puede confirmar que no haya alertas pendientes.')

  // Filter out alerts dismissed by the current user (client-side because
  // postgrest's array-contains filter on uuid[] doesn't accept JSON syntax —
  // and the list is small).
  const rows = data ?? []
  return rows.filter((r) => {
    const dismissed = (r as { dismissed_by?: string[] | null }).dismissed_by ?? []
    const expires = r.expires_at ? new Date(r.expires_at).getTime() : null
    return !dismissed.includes(user.id) && (expires === null || expires > Date.now())
  })
}

export async function dismissAlert(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: alert } = await supabase
    .from('alerts')
    .select('dismissed_by')
    .eq('id', id)
    .single()

  if (!alert) return { error: 'Alert not found' }

  const dismissed_by = [...(alert.dismissed_by ?? []), user.id]

  const { error } = await supabase
    .from('alerts')
    .update({ dismissed_by })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/alerts')
  return { success: true }
}

export async function createAlert(values: {
  title: string
  message?: string
  severity: string
  target_role?: string
  expires_at?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('alerts').insert({
    ...values,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/alerts')
  return { success: true }
}
