'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getAlerts() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
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
