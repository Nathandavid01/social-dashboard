'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { RecordingSession } from '@/lib/supabase/types'

const SELECT = `
  *,
  client:clients!recording_sessions_client_id_fkey(id, name),
  videographer:profiles!recording_sessions_videographer_id_fkey(id, full_name)
`

export async function getRecordingSessions(filters?: {
  month?: string // YYYY-MM
  videographerId?: string
  clientId?: string
}) {
  const supabase = await createClient()
  let query = supabase.from('recording_sessions').select(SELECT).order('session_date').order('start_time', { nullsFirst: true })

  if (filters?.month) {
    const start = `${filters.month}-01`
    const end = new Date(filters.month + '-01')
    end.setMonth(end.getMonth() + 1)
    const endStr = end.toISOString().slice(0, 10)
    query = query.gte('session_date', start).lt('session_date', endStr)
  }
  if (filters?.videographerId) query = query.eq('videographer_id', filters.videographerId)
  if (filters?.clientId) query = query.eq('client_id', filters.clientId)

  const { data, error } = await query
  if (error) return { sessions: [] as RecordingSession[], error: error.message }
  return { sessions: (data ?? []) as unknown as RecordingSession[] }
}

export async function createRecordingSession(values: {
  session_date: string
  client_id: string | null
  videographer_id: string | null
  title: string
  notes?: string | null
  location?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_address?: string | null
  start_time?: string | null
  end_time?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('recording_sessions').insert({
    ...values,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  return { success: true }
}

export async function updateRecordingSession(id: string, values: Partial<{
  session_date: string
  client_id: string | null
  videographer_id: string | null
  title: string
  notes: string | null
  location: string | null
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  start_time: string | null
  end_time: string | null
  status: string
}>) {
  const supabase = await createClient()
  const { error } = await supabase.from('recording_sessions').update(values).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  return { success: true }
}

export async function deleteRecordingSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('recording_sessions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  return { success: true }
}
