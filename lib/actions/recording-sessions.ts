'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, requirePermission } from '@/lib/auth/server'
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

  // Decisión 2026-09-01: toda grabación lleva cliente y videógrafo. Sin
  // cliente, el On Site no sabe de quién es el material y el pipeline no
  // puede enlazarlo; sin videógrafo, nadie tiene la sesión en su agenda.
  if (!values.client_id) return { error: 'Elige el cliente de la grabación.' }
  let videographerId = values.videographer_id ?? null
  if (!videographerId) {
    // Quien no puede asignar (rol video) graba él mismo: la sesión es suya.
    if (await currentUserHas('recording.brief')) return { error: 'Elige el videógrafo que va a grabar.' }
    videographerId = user.id
  }

  const { error } = await supabase.from('recording_sessions').insert({
    ...values,
    videographer_id: videographerId,
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
  try {
    await requireSessionWrite(values, 'update')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if ('client_id' in values && !values.client_id) return { error: 'La grabación tiene que tener cliente.' }
  if ('videographer_id' in values && !values.videographer_id) return { error: 'La grabación tiene que tener videógrafo.' }

  const supabase = await createClient()
  const { error } = await supabase.from('recording_sessions').update(values).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  return { success: true }
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
  return { success: true }
}
