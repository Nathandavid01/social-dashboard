'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { OnsiteShot } from '@/lib/onsite/shot-types'
import { requiredForOnsite } from '@/lib/onsite/slot-count'
import { planOnsiteBriefFill, type BriefGenerated } from '@/lib/onsite/brief-fill'
import { generateIdeaBatch } from '@/lib/llm/generate-ideas-run'
import { clampVirality } from '@/lib/onsite/virality'

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
  /** Días de posteo por semana, del perfil. */
  perWeek: number
  /** Posts este mes, el mismo /mes de Días de posting. */
  perMonth: number
  /** Videos recomendados en esta grabación: perMonth × 1.5. */
  slotTarget: number
  arrivedAt: string | null
  arrivedById: string | null
  arrivedByName: string | null
}

/** Sesiones agendadas — On Site trabaja sobre lo que hay en el calendario. */
export async function getOnsiteSessions(): Promise<{ sessions?: OnsiteSession[]; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const base = 'id, title, session_date, client_id, location, status, client:clients(name, posting_days)'
  const first = await supabase
    .from('recording_sessions')
    .select(`${base}, arrived_at, arrived_by`)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })
  const loaded = first.error
    ? await supabase
      .from('recording_sessions')
      .select(base)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
    : first
  if (loaded.error) return { error: loaded.error.message }

  const rows = (loaded.data ?? []) as Array<{
    id: string
    title: string
    session_date: string
    client_id: string | null
    location: string | null
    status: string
    client: unknown
    arrived_at?: string | null
    arrived_by?: string | null
  }>
  const arriverIds = Array.from(new Set(rows.map((s) => s.arrived_by).filter((id): id is string => Boolean(id))))
  const names: Record<string, string> = {}
  if (arriverIds.length > 0) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', arriverIds)
    for (const p of people ?? []) {
      if (p.full_name) names[p.id] = p.full_name
    }
  }

  return {
    sessions: rows.map((s) => {
      const raw = s.client as { name?: string; posting_days?: number[] | null } | { name?: string; posting_days?: number[] | null }[] | null
      const c = Array.isArray(raw) ? raw[0] : raw
      const quota = requiredForOnsite({ postingDays: c?.posting_days })
      const arrivedBy = (s as { arrived_by?: string | null }).arrived_by ?? null
      return {
        id: s.id,
        title: s.title,
        date: s.session_date,
        clientId: s.client_id,
        clientName: c?.name ?? 'Sin cliente',
        location: s.location,
        status: s.status,
        perWeek: quota.perWeek,
        perMonth: quota.perMonth,
        slotTarget: quota.slotTarget,
        arrivedAt: (s as { arrived_at?: string | null }).arrived_at ?? null,
        arrivedById: arrivedBy,
        arrivedByName: arrivedBy ? (names[arrivedBy] ?? 'Equipo') : null,
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
    .select('id, title, hook, visual_brief, rationale, shot_type, reference_url, status')
    .eq('recording_session_id', sessionId)
    .neq('status', 'descartada')
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }

  return {
    shots: (data ?? []).map((i) => ({
      id: i.id,
      title: i.title?.trim() || i.hook?.trim() || 'Sin título',
      hook: i.hook,
      visualBrief: (i.visual_brief as string | null) ?? null,
      viralityScore: clampVirality((i as { virality_score?: unknown }).virality_score),
      viralityWhy: (i.rationale as string | null) ?? null,
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

/** Completar el brief: Lab/pipeline primero, el resto con la misma IA del Lab. */
export async function generateOnsiteIdeas(input: {
  sessionId: string
  count: number
}): Promise<{ created?: number; error?: string }> {
  try {
    await requirePermission('recording.brief')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const n = Math.min(40, Math.max(0, Math.floor(input.count)))
  if (n === 0) return { error: 'No hay espacios que generar' }

  const { ideas: addable, error: addableError } = await getAddableIdeas(input.sessionId)
  if (addableError) return { error: addableError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: session } = await supabase
    .from('recording_sessions')
    .select('id, client_id, client:clients(name, industry, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, metricool_blog_id)')
    .eq('id', input.sessionId)
    .single()
  if (!session?.client_id) return { error: 'Esta sesión no tiene cliente: asígnalo en el calendario.' }

  const raw = session.client as Record<string, string | null> | Record<string, string | null>[] | null
  const client = Array.isArray(raw) ? raw[0] : raw

  const { data: existingIdeas } = await supabase
    .from('content_ideas')
    .select('title')
    .eq('client_id', session.client_id)
    .neq('status', 'descartada')
  const taken = new Set((existingIdeas ?? []).map((i) => (i.title ?? '').trim().toLowerCase()))
  const addableFresh = (addable ?? []).filter((a) => !taken.has(a.title.trim().toLowerCase()))

  const stillNeed = n - Math.min(n, addableFresh.length)
  const generated: BriefGenerated[] = []
  if (stillNeed > 0) {
    try {
      while (generated.length < stillNeed) {
        const batch = Math.min(8, stillNeed - generated.length)
        const { ideas } = await generateIdeaBatch({
          clientId: session.client_id,
          clientName: client?.name ?? undefined,
          industry: client?.industry,
          brandVoice: client?.brand_voice,
          captionLanguage: client?.caption_language,
          defaultCta: client?.default_cta,
          defaultHashtags: client?.default_hashtags,
          captionNotes: client?.caption_notes,
          metricoolBlogId: client?.metricool_blog_id,
          contentTypes: ['R'],
          count: batch,
        })
        if (!ideas.length) break
        generated.push(...ideas.map((i) => ({
          title: i.title,
          hook: i.hook,
          visual_brief: i.visual_brief,
          content_type: i.content_type,
          rationale: i.rationale ?? null,
          virality_score: clampVirality(i.virality_score),
        })))
      }
    } catch (err) {
      if ((addableFresh.length) === 0) {
        return { error: err instanceof Error ? err.message : 'No se pudieron generar ideas' }
      }
    }
  }

  const plan = planOnsiteBriefFill({
    need: n,
    addable: addableFresh.map((a) => ({ id: a.id, source: a.source, title: a.title })),
    generated,
  })

  let created = 0
  for (const a of plan.attach) {
    const res = await addIdeaToSession({ sessionId: input.sessionId, ideaId: a.id, source: a.source })
    if (res.error) return { error: res.error, created }
    created += 1
  }

  if (plan.create.length > 0) {
    const { error } = await supabase.from('content_ideas').insert(
      plan.create.map((i) => ({
        client_id: session.client_id,
        content_type: i.content_type || 'R',
        title: i.title?.trim() || 'Sin título',
        hook: i.hook?.trim() || null,
        visual_brief: i.visual_brief?.trim() || null,
        rationale: i.rationale?.trim() || null,
        status: 'idea',
        recording_session_id: input.sessionId,
        created_by: user?.id ?? null,
      })),
    )
    if (error) return { error: error.message, created }
    created += plan.create.length
  }

  if (created === 0) return { error: 'No había ideas del Lab ni la IA devolvió ninguna' }

  revalidatePath('/onsite')
  return { created }
}

/** Editar el brief de una toma (título, de qué es, referencia). */
export async function updateOnsiteIdea(input: {
  ideaId: string
  title?: string
  hook?: string | null
  visualBrief?: string | null
  referenceUrl?: string | null
  shotType?: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.brief')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const patch: Record<string, string | null> = {}
  if (input.title !== undefined) {
    const t = input.title.trim()
    if (!t && !(input.hook && input.hook.trim())) return { error: 'Ponle un título o de qué es' }
    patch.title = t || (input.hook?.trim() ?? 'Sin título')
  }
  if (input.hook !== undefined) patch.hook = input.hook?.trim() || null
  if (input.visualBrief !== undefined) patch.visual_brief = input.visualBrief?.trim() || null
  if (input.referenceUrl !== undefined) patch.reference_url = input.referenceUrl?.trim() || null
  if (input.shotType !== undefined) patch.shot_type = input.shotType || null
  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.from('content_ideas').update(patch).eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  return { ok: true }
}

/** El equipo de grabación sella que llegó al local. Un sello por sesión. */
export async function checkInOnsite(sessionId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('recording.complete')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: row } = await supabase
    .from('recording_sessions')
    .select('id, arrived_at')
    .eq('id', sessionId)
    .single()
  if (!row) return { error: 'Sesión no encontrada' }
  if (row.arrived_at) return { ok: true }

  const { error } = await supabase
    .from('recording_sessions')
    .update({ arrived_at: new Date().toISOString(), arrived_by: user.id })
    .eq('id', sessionId)
    .is('arrived_at', null)
  if (error) return { error: error.message }

  revalidatePath('/onsite')
  return { ok: true }
}
