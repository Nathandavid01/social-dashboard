'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { RecordingSession } from '@/lib/supabase/types'

async function notifyAssignment(userId: string, sessionId: string, title: string, date: string) {
  try {
    const db = await createClient()
    // Do not SELECT the inserted row: RLS allows reading only one's own inbox.
    const { error } = await db.from('notifications').insert({
      user_id: userId, kind: 'task_assigned', title: 'Nueva Grabación Asignada',
      body: `${title} · ${date}. Revisa la hora, el lugar y las ideas en tu agenda.`,
      link: `/onsite?s=${sessionId}`, severity: 'info', meta: { recording_session_id: sessionId },
    })
    return error ? 'La sesión se guardó, pero no se pudo enviar el aviso. La asignación está en la agenda personal.' : undefined
  } catch {
    return 'La sesión se guardó, pero el aviso no se pudo confirmar. Revisa la agenda personal.'
  }
}

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

const ASSIGNMENT_KEYS = [
  'videographer_id',
  'location',
  'location_address',
  'location_lat',
  'location_lng',
] as const

function isFilledAssignment(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function hasAssignmentValues(values: Record<string, unknown>): boolean {
  return ASSIGNMENT_KEYS.some((key) => isFilledAssignment(values[key]))
}

function hasAssignmentKeys(values: object): boolean {
  return ASSIGNMENT_KEYS.some((key) => key in values)
}

async function requireSessionWrite(values: object, mode: 'create' | 'update') {
  await requirePermission('recording.create')
  const needsBrief = mode === 'create'
    ? hasAssignmentValues(values as Record<string, unknown>)
    : hasAssignmentKeys(values)
  if (needsBrief) await requirePermission('recording.brief')
}

export async function createRecordingSession(values: {
  session_date: string
  client_id: string | null
  videographer_id?: string | null
  title: string
  notes?: string | null
  location?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_address?: string | null
  start_time?: string | null
  end_time?: string | null
}) {
  try {
    await requireSessionWrite(values, 'create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sessionId = randomUUID()
  const { error } = await supabase.from('recording_sessions').insert({
    id: sessionId,
    ...values,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  const warning = values.videographer_id ? await notifyAssignment(values.videographer_id, sessionId, values.title, values.session_date) : undefined
  revalidatePath('/recording-calendar')
  revalidatePath('/mi-dia')
  revalidatePath('/account/profile')
  revalidatePath('/team/[memberId]', 'page')
  revalidatePath('/onsite')
  return warning ? { success: true, id: sessionId, warning } : { success: true, id: sessionId }
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
  try {
    await requireSessionWrite(values, 'update')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const prior = values.videographer_id ? await supabase.from('recording_sessions')
    .select('videographer_id,title,session_date').eq('id', id).single() : null
  if (prior?.error) return { error: prior.error.message }
  if (values.videographer_id && !prior?.data) return { error: 'Sesión No Encontrada' }
  const { error } = await supabase.from('recording_sessions').update(values).eq('id', id)
  if (error) return { error: error.message }
  const warning = values.videographer_id && values.videographer_id !== prior?.data?.videographer_id
    ? await notifyAssignment(values.videographer_id, id, values.title ?? prior?.data?.title ?? 'Grabación', values.session_date ?? prior?.data?.session_date ?? '') : undefined
  revalidatePath('/recording-calendar')
  revalidatePath('/mi-dia')
  revalidatePath('/account/profile')
  revalidatePath('/team/[memberId]', 'page')
  revalidatePath('/onsite')
  return warning ? { success: true, warning } : { success: true }
}

export async function deleteRecordingSession(id: string) {
  // No pedía nada: cualquiera con sesión que llegara a la pantalla podía
  // borrar agenda, y borra de verdad — no marca como cancelada.
  try {
    await requirePermission('recording.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('recording_sessions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  revalidatePath('/mi-dia')
  revalidatePath('/account/profile')
  revalidatePath('/team/[memberId]', 'page')
  revalidatePath('/onsite')
  return { success: true }
}
