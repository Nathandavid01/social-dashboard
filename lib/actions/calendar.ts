'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CalendarItem } from '@/lib/supabase/types'

/**
 * Aggregate read-only calendar items across multiple sources within [startISO, endISO]:
 *  - manual posting events (content_events.scheduled_at)         → 'posting'
 *  - idea recording dates  (content_ideas.recording_date)        → 'grabacion'
 *  - idea publish dates    (content_ideas.publish_date)          → 'publicacion'
 *  - recording sessions    (recording_sessions.session_date)     → 'sesion'
 * Assignee for ideas comes from the linked production task.
 */
export async function getCalendarItems(startISO: string, endISO: string): Promise<CalendarItem[]> {
  const supabase = await createClient()
  const startDate = startISO.slice(0, 10)
  const endDate = endISO.slice(0, 10)
  const atNoon = (d: string) => `${d.slice(0, 10)}T12:00:00`

  const [{ data: events }, { data: ideas }, { data: sessions }] = await Promise.all([
    supabase
      .from('content_events')
      .select('id, title, scheduled_at, client_id, client:clients!content_events_client_id_fkey(id, name), assignee:profiles!content_events_assignee_id_fkey(id, full_name)')
      .gte('scheduled_at', startISO)
      .lte('scheduled_at', endISO),
    supabase
      .from('content_ideas')
      .select(`
        id, title, recording_date, publish_date, client_id,
        client:clients!content_ideas_client_id_fkey(id, name),
        production_task:production_tasks!content_ideas_production_task_id_fkey(
          assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name)
        )
      `)
      .or(`and(recording_date.gte.${startDate},recording_date.lte.${endDate}),and(publish_date.gte.${startDate},publish_date.lte.${endDate})`),
    supabase
      .from('recording_sessions')
      .select('id, title, session_date, client_id, client:clients!recording_sessions_client_id_fkey(id, name), videographer:profiles!recording_sessions_videographer_id_fkey(id, full_name)')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .neq('status', 'cancelled'),
  ])

  const items: CalendarItem[] = []

  for (const e of events ?? []) {
    const ev = e as unknown as { id: string; title: string; scheduled_at: string; client?: { id: string; name: string } | null; assignee?: { id: string; full_name: string | null } | null }
    items.push({
      id: `posting:${ev.id}`,
      type: 'posting',
      date: ev.scheduled_at,
      title: ev.title,
      clientId: ev.client?.id ?? null,
      clientName: ev.client?.name ?? null,
      assignee: ev.assignee ?? null,
      href: null,
    })
  }

  for (const i of ideas ?? []) {
    const idea = i as unknown as {
      id: string; title: string; recording_date: string | null; publish_date: string | null
      client?: { id: string; name: string } | null
      production_task?: { assigned_to?: { id: string; full_name: string | null } | null } | null
    }
    const assignee = idea.production_task?.assigned_to ?? null
    const base = {
      title: idea.title || 'Sin título',
      clientId: idea.client?.id ?? null,
      clientName: idea.client?.name ?? null,
      assignee,
      href: `/produccion/idea/${idea.id}`,
    }
    if (idea.recording_date && idea.recording_date >= startDate && idea.recording_date <= endDate) {
      items.push({ id: `grabacion:${idea.id}`, type: 'grabacion', date: atNoon(idea.recording_date), ...base })
    }
    if (idea.publish_date && idea.publish_date >= startDate && idea.publish_date <= endDate) {
      items.push({ id: `publicacion:${idea.id}`, type: 'publicacion', date: atNoon(idea.publish_date), ...base })
    }
  }

  for (const s of sessions ?? []) {
    const ses = s as unknown as { id: string; title: string; session_date: string; client?: { id: string; name: string } | null; videographer?: { id: string; full_name: string | null } | null }
    items.push({
      id: `sesion:${ses.id}`,
      type: 'sesion',
      date: atNoon(ses.session_date),
      title: ses.title || 'Sesión de grabación',
      clientId: ses.client?.id ?? null,
      clientName: ses.client?.name ?? null,
      assignee: ses.videographer ?? null,
      href: '/recording-calendar',
    })
  }

  return items
}

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
