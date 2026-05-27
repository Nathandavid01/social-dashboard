'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ProductionContentType, ProductionPriority, ProductionTaskStatus } from '@/lib/supabase/types'

// ── Schedules ────────────────────────────────────────────────────────────────

export async function getProductionSchedules() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('production_schedules')
    .select(`
      *,
      client:clients!production_schedules_client_id_fkey(id, name, industry),
      assigned_editor:profiles!production_schedules_assigned_editor_id_fkey(id, full_name),
      assigned_designer:profiles!production_schedules_assigned_designer_id_fkey(id, full_name)
    `)
    .order('day_of_week')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertProductionSchedules(
  clientId: string,
  schedules: { day_of_week: number; content_type: ProductionContentType; assigned_editor_id?: string | null; assigned_designer_id?: string | null }[],
  existingDays?: number[]
) {
  const supabase = await createClient()

  // Remove all existing schedules for this client if we're doing a full replace
  if (existingDays && existingDays.length > 0) {
    await supabase
      .from('production_schedules')
      .delete()
      .eq('client_id', clientId)
  }

  if (schedules.length === 0) {
    revalidatePath('/produccion')
    return { error: null }
  }

  const { error } = await supabase
    .from('production_schedules')
    .upsert(
      schedules.map((s) => ({
        client_id: clientId,
        day_of_week: s.day_of_week,
        content_type: s.content_type,
        assigned_editor_id: s.assigned_editor_id ?? null,
        assigned_designer_id: s.assigned_designer_id ?? null,
      })),
      { onConflict: 'client_id,day_of_week,content_type' }
    )

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function deleteClientSchedules(clientId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_schedules')
    .delete()
    .eq('client_id', clientId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function updateScheduleAssignment(
  scheduleId: string,
  editorId: string | null,
  designerId: string | null
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_schedules')
    .update({ assigned_editor_id: editorId, assigned_designer_id: designerId })
    .eq('id', scheduleId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getProductionTasks(filters?: {
  weekStart?: string
  assignedToId?: string
  status?: ProductionTaskStatus | 'all'
  clientId?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('production_tasks')
    .select(`
      *,
      client:clients!production_tasks_client_id_fkey(id, name, industry),
      assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name)
    `)
    .order('publish_date')
    .order('content_type')

  if (filters?.weekStart) {
    const weekEnd = new Date(filters.weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    query = query
      .gte('publish_date', filters.weekStart)
      .lte('publish_date', weekEnd.toISOString().slice(0, 10))
  }
  if (filters?.assignedToId) {
    query = query.eq('assigned_to_id', filters.assignedToId)
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  const { data, error } = await query.limit(500)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getReviewQueueTasks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('production_tasks')
    .select(`
      *,
      client:clients!production_tasks_client_id_fkey(id, name, industry),
      assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name)
    `)
    .in('status', ['en_revision', 'revisiones', 'aprobado'])
    .order('publish_date')
    .limit(200)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getMyProductionTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('production_tasks')
    .select(`
      *,
      client:clients!production_tasks_client_id_fkey(id, name, industry),
      assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name)
    `)
    .eq('assigned_to_id', user.id)
    .neq('status', 'publicado')
    .order('publish_date')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function generateProductionTasks(weekStart: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', count: 0 }

  // Get all production schedules
  const { data: schedules } = await supabase
    .from('production_schedules')
    .select('*, client:clients!production_schedules_client_id_fkey(id, name)')

  if (!schedules?.length) return { error: null, count: 0 }

  const monday = new Date(weekStart + 'T12:00:00Z')
  const tasks: {
    client_id: string
    schedule_id: string
    content_type: ProductionContentType
    publish_date: string
    deadline: string
    assigned_to_id: string | null
    status: ProductionTaskStatus
    week_start: string
    created_by: string
    priority: ProductionPriority
  }[] = []

  for (const s of schedules) {
    const dayOffset = s.day_of_week - 1 // 0=Mon, 6=Sun
    const publishDate = new Date(monday)
    publishDate.setDate(monday.getDate() + dayOffset)
    const publishDateStr = publishDate.toISOString().slice(0, 10)

    // Deadline = 36 hours before midnight of publish_date
    const deadline = new Date(publishDate)
    deadline.setDate(deadline.getDate() - 1)
    deadline.setHours(12, 0, 0, 0)

    const assignedTo = s.content_type === 'P'
      ? s.assigned_designer_id
      : s.assigned_editor_id

    tasks.push({
      client_id: s.client_id,
      schedule_id: s.id,
      content_type: s.content_type,
      publish_date: publishDateStr,
      deadline: deadline.toISOString(),
      assigned_to_id: assignedTo ?? null,
      status: 'pendiente',
      week_start: weekStart,
      created_by: user.id,
      priority: 'media',
    })
  }

  // Delete existing tasks for this week first (to avoid duplicates)
  const weekEnd = new Date(monday)
  weekEnd.setDate(monday.getDate() + 6)
  await supabase
    .from('production_tasks')
    .delete()
    .gte('publish_date', weekStart)
    .lte('publish_date', weekEnd.toISOString().slice(0, 10))
    .eq('is_special_request', false)
    .not('week_start', 'is', null)

  const { error } = await supabase.from('production_tasks').insert(tasks)

  revalidatePath('/produccion')
  return { error: error?.message ?? null, count: tasks.length }
}

export async function updateTaskStatus(taskId: string, status: ProductionTaskStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_tasks')
    .update({ status })
    .eq('id', taskId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function updateTaskNotes(taskId: string, notes: string, reviewNotes?: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_tasks')
    .update({ notes, review_notes: reviewNotes ?? null })
    .eq('id', taskId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function reassignTask(taskId: string, assignedToId: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_tasks')
    .update({ assigned_to_id: assignedToId })
    .eq('id', taskId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function createSpecialRequest(data: {
  clientId: string
  contentType: ProductionContentType
  publishDate: string
  assignedToId: string | null
  priority: ProductionPriority
  notes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const deadline = new Date(data.publishDate + 'T12:00:00')
  deadline.setDate(deadline.getDate() - 1)

  const { error } = await supabase.from('production_tasks').insert({
    client_id: data.clientId,
    content_type: data.contentType,
    publish_date: data.publishDate,
    deadline: deadline.toISOString(),
    assigned_to_id: data.assignedToId,
    status: 'pendiente',
    notes: data.notes,
    is_special_request: true,
    priority: data.priority,
    created_by: user.id,
  })

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}

export async function deleteProductionTask(taskId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_tasks')
    .delete()
    .eq('id', taskId)

  revalidatePath('/produccion')
  return { error: error?.message ?? null }
}
