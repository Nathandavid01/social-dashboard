'use server'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, getEffectiveUserId } from '@/lib/auth/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import type { RecordingSession } from '@/lib/supabase/types'

export type AssignedRecordingsResult = {
  memberId: string
  sessions: RecordingSession[]
  error: string | null
  /** Owner/supervisor Mi Día: full upcoming agenda (operations.overview), not only own assignments. */
  overview: boolean
}

export async function getAssignedRecordings(memberId?: string): Promise<AssignedRecordingsResult | null> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const effectiveId = await getEffectiveUserId() || user.id
  const viewingOther = Boolean(memberId && memberId !== effectiveId && memberId !== user.id)
  if (viewingOther && !await currentUserHas('team.read')) return null
  const { data: profile } = await db.from('profiles').select('status,approval_status').eq('id', user.id).single()
  if (!profile || profile.status === 'inactive' || ['pending', 'rejected'].includes(profile.approval_status)) return null

  // Same gate as Mi Día RoleGate: owner/supervisor see the full upcoming grabaciones overview.
  // When opening another member's page (memberId of someone else), keep scoped to that videographer.
  const overview = !viewingOther && await currentUserHas('operations.overview')

  const select =
    'id,title,session_date,start_time,end_time,location,location_address,status,videographer_id,client_id,confirmation_status,videographer_confirmed_at,client_confirmed_at,videographer:profiles!recording_sessions_videographer_id_fkey(id, full_name)'
  const today = todayISOInTimeZone('America/Puerto_Rico')
  const base = db.from('recording_sessions').select(select)

  const filtered = overview
    ? base
    : base.eq('videographer_id', memberId || effectiveId)

  const { data, error } = await filtered
    .gte('session_date', today)
    .not('status', 'in', '(completed,cancelled)')
    .order('session_date')
    .order('start_time', { nullsFirst: false })
    .limit(30)

  return {
    memberId: memberId || effectiveId,
    sessions: (data ?? []) as unknown as RecordingSession[],
    error: error ? 'No se pudo cargar la agenda asignada.' : null,
    overview,
  }
}
