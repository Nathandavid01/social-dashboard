'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { OnsiteShot } from '@/lib/onsite/shot-types'

/**
 * On Site — la lista de grabación de una sesión agendada.
 *
 * Las tomas SON content_ideas: marcar la burbuja pone status='grabada', el
 * mismo estado que lee Mi Día y el pipeline. Un check propio daría dos
 * números de "grabadas" que acabarían discrepando.
 */

export interface OnsiteSession {
  id: string
  title: string
  date: string
  clientId: string | null
  clientName: string
  location: string | null
  status: string
}

/** Sesiones agendadas — On Site trabaja sobre lo que hay en el calendario. */
export async function getOnsiteSessions(): Promise<{ sessions?: OnsiteSession[]; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recording_sessions')
    .select('id, title, session_date, client_id, location, status, client:clients(name)')
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })
  if (error) return { error: error.message }

  return {
    sessions: (data ?? []).map((s) => {
      const c = s.client as { name?: string } | null
      return {
        id: s.id,
        title: s.title,
        date: s.session_date,
        clientId: s.client_id,
        clientName: c?.name ?? 'Sin cliente',
        location: s.location,
        status: s.status,
      }
    }),
  }
}

/** Las tomas de una sesión. */
export async function getOnsiteShots(
  sessionId: string,
): Promise<{ shots?: OnsiteShot[]; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, title, hook, shot_type, reference_url, status')
    .eq('recording_session_id', sessionId)
    .neq('status', 'descartada')
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }

  return {
    shots: (data ?? []).map((i) => ({
      id: i.id,
      title: i.title?.trim() || i.hook?.trim() || 'Sin título',
      hook: i.hook,
      referenceUrl: (i.reference_url as string | null) ?? null,
      shotType: (i.shot_type as string | null) ?? null,
      // 'grabada' y todo lo que va después cuentan como grabado: un video ya
      // producido no puede aparecer como pendiente de grabar.
      recorded: ['grabada', 'producida', 'publicada'].includes(i.status ?? ''),
    })),
  }
}

/**
 * Marcar o desmarcar una toma. Escribe el MISMO status que el resto de la app.
 *
 * Desmarcar solo vuelve a 'idea' si el video no pasó de grabado: si ya está
 * producido o publicado, quitarle el check aquí lo sacaría del pipeline.
 */
export async function toggleShotRecorded(input: {
  ideaId: string
  recorded: boolean
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.complete')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('status')
    .eq('id', input.ideaId)
    .single()
  if (!idea) return { error: 'Toma no encontrada' }

  if (!input.recorded && !['grabada', 'idea', 'asignada'].includes(idea.status ?? '')) {
    return { error: 'Este video ya avanzó en el pipeline: no se puede desmarcar aquí.' }
  }

  const { error } = await supabase
    .from('content_ideas')
    .update({
      status: input.recorded ? 'grabada' : 'idea',
      recording_date: input.recorded ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  revalidatePath('/mi-dia')
  return { ok: true }
}

/** Cambiar el tipo de toma o su enlace de referencia. */
export async function updateShotDetails(input: {
  ideaId: string
  shotType?: string | null
  referenceUrl?: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const patch: Record<string, string | null> = {}
  if (input.shotType !== undefined) patch.shot_type = input.shotType || null
  if (input.referenceUrl !== undefined) patch.reference_url = input.referenceUrl?.trim() || null
  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.from('content_ideas').update(patch).eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  return { ok: true }
}

/** Quitar una toma de la sesión. No la borra: la desliga. */
export async function removeShotFromSession(ideaId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  // Desligar, no borrar: la idea sigue existiendo en el pipeline y se puede
  // volver a añadir a otra sesión.
  const { error } = await supabase
    .from('content_ideas')
    .update({ recording_session_id: null })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  return { ok: true }
}

export interface AddableIdea {
  id: string
  title: string
  hook: string | null
  /** 'pipeline' = ya es una content_idea; 'lab' = idea aprobada del Idea Lab. */
  source: 'pipeline' | 'lab'
}

/**
 * Lo que se puede añadir a la sesión: las ideas del cliente sin grabar y sin
 * sesión, más las aprobadas del Idea Lab.
 */
export async function getAddableIdeas(
  sessionId: string,
): Promise<{ ideas?: AddableIdea[]; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('recording_sessions')
    .select('client_id')
    .eq('id', sessionId)
    .single()
  if (!session?.client_id) return { ideas: [] }

  const [{ data: pipeline }, { data: lab }] = await Promise.all([
    supabase
      .from('content_ideas')
      .select('id, title, hook')
      .eq('client_id', session.client_id)
      .is('recording_session_id', null)
      .in('status', ['idea', 'asignada'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('idea_lab_feedback')
      .select('id, title, hook')
      .eq('client_id', session.client_id)
      .eq('verdict', 'approved')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    ideas: [
      ...(pipeline ?? []).map((i) => ({
        id: i.id, title: i.title?.trim() || i.hook?.trim() || 'Sin título', hook: i.hook, source: 'pipeline' as const,
      })),
      ...(lab ?? []).map((i) => ({
        id: i.id, title: i.title?.trim() || i.hook?.trim() || 'Sin título', hook: i.hook, source: 'lab' as const,
      })),
    ],
  }
}

/**
 * Añadir una idea a la sesión.
 *
 * Del pipeline: solo se liga. Del Lab: hay que COPIARLA a content_ideas —
 * idea_lab_feedback es otra tabla y el resto de la app (grabado, edición,
 * publicación) solo entiende content_ideas.
 */
export async function addIdeaToSession(input: {
  sessionId: string
  ideaId: string
  source: 'pipeline' | 'lab'
  shotType?: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (input.source === 'pipeline') {
    const { error } = await supabase
      .from('content_ideas')
      .update({ recording_session_id: input.sessionId, shot_type: input.shotType || null })
      .eq('id', input.ideaId)
    if (error) return { error: error.message }
    revalidatePath('/onsite')
    return { ok: true }
  }

  const { data: session } = await supabase
    .from('recording_sessions')
    .select('client_id')
    .eq('id', input.sessionId)
    .single()
  if (!session?.client_id) return { error: 'La sesión no tiene cliente' }

  const { data: labIdea } = await supabase
    .from('idea_lab_feedback')
    .select('title, hook, visual_brief, caption_angle, hashtags_suggestion, rationale, content_type')
    .eq('id', input.ideaId)
    .single()
  if (!labIdea) return { error: 'Idea del Lab no encontrada' }

  const { error } = await supabase.from('content_ideas').insert({
    client_id: session.client_id,
    content_type: labIdea.content_type ?? 'R',
    title: labIdea.title ?? 'Sin título',
    hook: labIdea.hook,
    visual_brief: labIdea.visual_brief,
    caption_angle: labIdea.caption_angle,
    hashtags_suggestion: labIdea.hashtags_suggestion,
    rationale: labIdea.rationale,
    status: 'idea',
    recording_session_id: input.sessionId,
    shot_type: input.shotType || null,
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  return { ok: true }
}
