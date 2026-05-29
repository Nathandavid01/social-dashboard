'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ContentIdea, ContentIdeaStatus, ContentIdeaType, ContentIdeaVideo, IdeaWithPipeline,
} from '@/lib/supabase/types'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { currentUserHas } from '@/lib/auth/server'

export async function getContentIdeas(filter?: {
  clientId?: string
  status?: ContentIdeaStatus | 'open'
  limit?: number
}): Promise<ContentIdea[]> {
  const supabase = await createClient()
  let query = supabase
    .from('content_ideas')
    .select(`
      *,
      client:clients!content_ideas_client_id_fkey(id, name, industry),
      production_task:production_tasks!content_ideas_production_task_id_fkey(id, status, publish_date)
    `)
    .order('created_at', { ascending: false })
    .limit(filter?.limit ?? 200)

  if (filter?.clientId) query = query.eq('client_id', filter.clientId)
  if (filter?.status === 'open') {
    query = query.in('status', ['idea', 'asignada', 'producida'])
  } else if (filter?.status) {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[content-ideas] fetch failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as ContentIdea[]
}

/**
 * Ideas enriched for the Ideación pipeline-rows view: joins the linked recording
 * session (for the "Agendada" stage) and the uploaded videos (for grabación/edición).
 * Returns a flat list; the board groups by client. Degrades to [] on error.
 */
export async function getIdeacionPipeline(filter?: {
  clientId?: string
  limit?: number
}): Promise<IdeaWithPipeline[]> {
  const supabase = await createClient()
  let query = supabase
    .from('content_ideas')
    .select(`
      *,
      client:clients!content_ideas_client_id_fkey(id, name, industry, logo_url, platforms),
      recording_session:recording_sessions!content_ideas_recording_session_id_fkey(status),
      videos:content_idea_videos!content_idea_videos_idea_id_fkey(*),
      production_task:production_tasks!content_ideas_production_task_id_fkey(
        id, status, publish_date,
        assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(filter?.limit ?? 300)
  if (filter?.clientId) query = query.eq('client_id', filter.clientId)

  const { data, error } = await query
  if (error) {
    console.warn('[content-ideas] pipeline fetch failed:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as ContentIdea & {
      recording_session?: { status?: string } | null
      videos?: ContentIdeaVideo[] | null
      production_task?: { assigned_to?: { id: string; full_name: string | null; avatar_url: string | null } | null } | null
    }
    const sessionStatus = r.recording_session?.status
    return {
      ...(r as ContentIdea),
      recordingScheduled:
        r.recording_session_id != null && (sessionStatus === 'scheduled' || sessionStatus === 'completed'),
      videos: (r.videos ?? []) as ContentIdeaVideo[],
      assignee: r.production_task?.assigned_to ?? null,
    } as IdeaWithPipeline
  })
}

/**
 * Videos currently assigned to a person and still in their court — i.e. linked
 * to a production task assigned to them, and not yet submitted for approval
 * (nor approved/published/discarded). Powers the "Videos asignados" section on
 * the person's profile. Returns [] on error.
 */
export async function getAssignedVideosForMember(memberId: string): Promise<IdeaWithPipeline[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_ideas')
    .select(`
      *,
      client:clients!content_ideas_client_id_fkey(id, name, industry, logo_url, platforms),
      recording_session:recording_sessions!content_ideas_recording_session_id_fkey(status),
      videos:content_idea_videos!content_idea_videos_idea_id_fkey(*),
      production_task:production_tasks!content_ideas_production_task_id_fkey!inner(
        id, status, publish_date, assigned_to_id,
        assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name, avatar_url)
      )
    `)
    .eq('production_task.assigned_to_id', memberId)
    .not('status', 'in', '(publicada,descartada)')
    .not('approval_status', 'in', '(submitted,approved)')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[content-ideas] assigned-videos fetch failed:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as ContentIdea & {
      recording_session?: { status?: string } | null
      videos?: ContentIdeaVideo[] | null
      production_task?: { assigned_to?: { id: string; full_name: string | null; avatar_url: string | null } | null } | null
    }
    const sessionStatus = r.recording_session?.status
    return {
      ...(r as ContentIdea),
      recordingScheduled:
        r.recording_session_id != null && (sessionStatus === 'scheduled' || sessionStatus === 'completed'),
      videos: (r.videos ?? []) as ContentIdeaVideo[],
      assignee: r.production_task?.assigned_to ?? null,
    } as IdeaWithPipeline
  })
}

export async function saveContentIdea(input: {
  clientId: string
  contentType: ContentIdeaType
  title: string
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtagsSuggestion?: string | null
  rationale?: string | null
  theme?: string | null
  generationPrompt?: string | null
  model?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: input.clientId,
      content_type: input.contentType,
      title: input.title,
      hook: input.hook ?? null,
      visual_brief: input.visualBrief ?? null,
      caption_angle: input.captionAngle ?? null,
      hashtags_suggestion: input.hashtagsSuggestion ?? null,
      rationale: input.rationale ?? null,
      theme: input.theme ?? null,
      generation_prompt: input.generationPrompt ?? null,
      model: input.model ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/planning')
  return { idea: data as ContentIdea }
}

export async function updateIdeaStatus(id: string, status: ContentIdeaStatus) {
  const supabase = await createClient()
  const { error } = await supabase.from('content_ideas').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  await logIdeaActivity(supabase, {
    ideaId: id,
    action: status === 'publicada' ? 'published' : 'status_changed',
    metadata: { status },
  })
  revalidatePath('/planning')
  revalidatePath('/recording-calendar')
  return { success: true }
}

// ── Inline date editing (recording / publish) ────────────────────────────────

/**
 * Update an idea's recording and/or publish dates inline.
 * Pass `null` for a field to clear it. Omit a field to leave it unchanged.
 * Dates are date-only strings ('YYYY-MM-DD').
 */
export async function updateIdeaDates(
  ideaId: string,
  dates: { recording_date?: string | null; publish_date?: string | null },
) {
  const supabase = await createClient()

  const patch: { recording_date?: string | null; publish_date?: string | null } = {}
  if ('recording_date' in dates) patch.recording_date = dates.recording_date || null
  if ('publish_date' in dates) patch.publish_date = dates.publish_date || null
  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await supabase.from('content_ideas').update(patch).eq('id', ideaId)
  if (error) return { error: error.message }

  await logIdeaActivity(supabase, { ideaId, action: 'status_changed', metadata: { dates: patch } })
  revalidatePath('/planning')
  revalidatePath('/recording-calendar')
  return { success: true }
}

// ── Manual idea creation (no AI) ─────────────────────────────────────────────

export async function createContentIdeaManual(input: {
  clientId: string
  contentType: ContentIdeaType
  title: string
  hook?: string | null
  visualBrief?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: input.clientId,
      content_type: input.contentType,
      title: input.title,
      hook: input.hook ?? null,
      visual_brief: input.visualBrief ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/planning')
  revalidatePath(`/clients/${input.clientId}`)
  revalidatePath('/recording-calendar')
  return { idea: data as ContentIdea }
}

// ── Session linking ───────────────────────────────────────────────────────────

export async function assignIdeaToSession(ideaId: string, sessionId: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ recording_session_id: sessionId })
    .eq('id', ideaId)
  if (error) return { error: error.message }
  revalidatePath('/recording-calendar')
  return { success: true }
}

// Mark a video as recorded → goes into the buffer (grabada)
export async function markIdeaRecorded(ideaId: string, recorded: boolean) {
  const supabase = await createClient()
  const newStatus: ContentIdeaStatus = recorded ? 'grabada' : 'idea'
  const { error } = await supabase
    .from('content_ideas')
    .update({ status: newStatus })
    .eq('id', ideaId)
  if (error) return { error: error.message }
  if (recorded) {
    await logIdeaActivity(supabase, { ideaId, action: 'recorded' })
  }
  revalidatePath('/recording-calendar')
  revalidatePath('/planning')
  return { success: true }
}

// ── Buffer query ──────────────────────────────────────────────────────────────

export async function getClientVideoBuffers(): Promise<{ client_id: string; client_name: string; buffer_count: number }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_ideas')
    .select('client_id, client:clients!content_ideas_client_id_fkey(id, name)')
    .eq('status', 'grabada')

  if (error || !data) return []

  const map = new Map<string, { client_id: string; client_name: string; buffer_count: number }>()
  for (const row of data) {
    const c = row.client as unknown as { id: string; name: string } | null
    if (!c) continue
    if (!map.has(c.id)) map.set(c.id, { client_id: c.id, client_name: c.name, buffer_count: 0 })
    map.get(c.id)!.buffer_count++
  }
  return Array.from(map.values()).sort((a, b) => a.buffer_count - b.buffer_count)
}

export async function deleteContentIdea(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('content_ideas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/planning')
  return { success: true }
}

export async function assignIdeaToProductionTask(input: {
  ideaId: string
  clientId: string
  contentType: ContentIdeaType
  publishDate: string  // YYYY-MM-DD
  assignedToId?: string | null
  weekStart?: string | null
}) {
  // Assigning videos to others is permission-gated (see CLAUDE.md RBAC).
  if (!(await currentUserHas('planning.assign'))) {
    return { error: 'No tienes permiso para asignar videos a producción.' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Map idea content_type to production content_type (R or P)
  // Production currently only supports R/P, so map C/S to P
  const productionType: 'R' | 'P' = input.contentType === 'R' ? 'R' : 'P'

  // Get the idea to copy its title/brief into notes
  const { data: idea } = await supabase.from('content_ideas').select('title, visual_brief').eq('id', input.ideaId).single()
  const notes = idea ? `${idea.title}${idea.visual_brief ? '\n\n— Visual brief —\n' + idea.visual_brief : ''}` : null

  // Create the production task
  const { data: task, error: taskErr } = await supabase
    .from('production_tasks')
    .insert({
      client_id: input.clientId,
      content_type: productionType,
      publish_date: input.publishDate,
      assigned_to_id: input.assignedToId ?? null,
      week_start: input.weekStart ?? null,
      status: 'pendiente',
      notes,
      idea_id: input.ideaId,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (taskErr) return { error: taskErr.message }

  // Update the idea to point at the task and mark assigned
  const { error: ideaErr } = await supabase
    .from('content_ideas')
    .update({ production_task_id: task.id, status: 'asignada' })
    .eq('id', input.ideaId)

  if (ideaErr) return { error: ideaErr.message, taskId: task.id }

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    clientId: input.clientId,
    userId: user?.id ?? null,
    action: 'assigned',
    metadata: { taskId: task.id, publishDate: input.publishDate, assignedToId: input.assignedToId ?? null },
  })

  revalidatePath('/planning')
  revalidatePath('/produccion')
  return { success: true, taskId: task.id }
}
