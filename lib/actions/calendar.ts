'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getEventsForWeek(startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_events')
    .select(`
      *,
      client:clients!content_events_client_id_fkey(id, name)
    `)
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', endDate)
    .order('scheduled_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createEvent(values: {
  title: string
  description?: string
  client_id?: string | null
  platform: string
  status: string
  scheduled_at: string
  assignee_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('content_events').insert({
    ...values,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return { success: true }
}

export async function updateEvent(id: string, values: Partial<{
  title: string
  platform: string
  status: string
  scheduled_at: string
  description: string
}>) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('content_events')
    .update(values)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('content_events').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return { success: true }
}
