'use server'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import type { RecordingSession } from '@/lib/supabase/types'

export async function getAssignedRecordings(memberId?: string) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  if (memberId && memberId !== user.id && !await currentUserHas('team.read')) return null
  const { data: profile } = await db.from('profiles').select('status,approval_status').eq('id', user.id).single()
  if (!profile || profile.status === 'inactive' || ['pending', 'rejected'].includes(profile.approval_status)) return null
  const { data, error } = await db.from('recording_sessions')
    .select('id,title,session_date,start_time,end_time,location,location_address,status,videographer_id')
    .eq('videographer_id', memberId || user.id)
    .gte('session_date', todayISOInTimeZone('America/Puerto_Rico'))
    .not('status', 'in', '(completed,cancelled)')
    .order('session_date').order('start_time', { nullsFirst: false }).limit(30)
  return { memberId: memberId || user.id, sessions: (data ?? []) as RecordingSession[], error: error ? 'No se pudo cargar la agenda asignada.' : null }
}
