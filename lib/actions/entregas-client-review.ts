'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { requirePermission } from '@/lib/auth/server'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { DIAS_DE_VIGENCIA, type DecisionCliente, type EnlaceRevision } from '@/lib/entregas/client-review'

/**
 * El enlace de aprobación que se manda al cliente, para el flujo de Entregas.
 *
 * Separado del de Eric: su función de base de datos filtra por su bucket y su
 * aprobación publica sola en Metricool. Aquí la aprobación para en Publicación.
 */

export interface EnlaceGuardado extends EnlaceRevision {
  token: string
  createdAt: string
}

/** Genera un enlace nuevo. El anterior deja de valer: un solo enlace vivo. */
export async function crearEnlaceCliente(
  ideaId: string,
): Promise<{ token?: string; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sin video editado no hay nada que aprobar, y el cliente vería una página
  // vacía sin entender por qué.
  const { data: videos } = await supabase
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .eq('storage_provider', 'entregas-r2')
    .limit(1)
  if (!videos || videos.length === 0) {
    return { error: 'Este video todavía no está subido.' }
  }

  // Se borra el anterior en vez de dejar los dos vivos: un enlace viejo
  // circulando por WhatsApp seguiría aceptando votos sobre el mismo video.
  await supabase.from('entregas_client_reviews').delete().eq('idea_id', ideaId)

  const expira = new Date()
  expira.setDate(expira.getDate() + DIAS_DE_VIGENCIA)

  const { data, error } = await supabase
    .from('entregas_client_reviews')
    .insert({ idea_id: ideaId, expires_at: expira.toISOString(), created_by: user?.id ?? null })
    .select('token')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  return { token: data.token as string }
}

/** El enlace vivo de un video, para pintarlo en la tarjeta de Copy. */
export async function getEnlaceCliente(
  ideaId: string,
): Promise<{ enlace?: EnlaceGuardado | null; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('entregas_client_reviews')
    .select('token, status, expires_at, comment, reviewer_name, created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { enlace: null }

  return {
    enlace: {
      token: data.token as string,
      status: data.status as EnlaceGuardado['status'],
      expiresAt: data.expires_at as string,
      comment: (data.comment as string | null) ?? null,
      reviewerName: (data.reviewer_name as string | null) ?? null,
      createdAt: data.created_at as string,
    },
  }
}

export interface RevisionPublica {
  ideaId: string
  clientName: string | null
  status: 'pending' | DecisionCliente
  expiresAt: string
  comment: string | null
  reviewerName: string | null
  videoUrl: string | null
}

/**
 * Lo que ve el cliente. Sin login: el token es la credencial y el filtrado pasa
 * dentro de la función SECURITY DEFINER, no aquí.
 *
 * No devuelve el copy a propósito — el cliente aprueba la pieza, no el texto.
 */
export async function getRevisionPublica(token: string): Promise<RevisionPublica | null> {
  if (!token) return null
  const supabase = createPublicClient()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_entregas_review', { p_token: token })
  if (error || !data) return null

  const r = data as Record<string, unknown>
  const key = (r.video_key as string | null) ?? null
  return {
    ideaId: r.idea_id as string,
    clientName: (r.client_name as string | null) ?? null,
    status: r.status as RevisionPublica['status'],
    expiresAt: r.expires_at as string,
    comment: (r.comment as string | null) ?? null,
    reviewerName: (r.reviewer_name as string | null) ?? null,
    // El bucket de Entregas, no el de Eric: con el suyo el reproductor saldría
    // vacío aunque la clave fuera correcta.
    videoUrl: key ? entregasR2PublicUrl(key) : null,
  }
}

/**
 * El voto del cliente, desde la página pública.
 *
 * Aprobar NO publica: la tarjeta llega a Publicación y el envío a Metricool lo
 * sigue dando una persona. Es la diferencia deliberada con el flujo de Eric,
 * donde el voto dispara el borrador solo.
 *
 * Rechazar devuelve el video a Editado y deja el texto del cliente donde el
 * editor ya lee las correcciones del equipo — misma caja, mismo sitio.
 */
export async function votarRevisionPublica(input: {
  token: string
  decision: DecisionCliente
  comment: string
  name: string
}): Promise<{ ok?: true; error?: string }> {
  const supabase = createPublicClient()
  if (!supabase) return { error: 'No disponible' }

  const { data, error } = await supabase.rpc('submit_entregas_review', {
    p_token: input.token,
    p_decision: input.decision,
    p_comment: input.comment,
    p_name: input.name,
  })
  if (error) return { error: error.message }

  const res = (data ?? {}) as { ok?: boolean; error?: string; idea_id?: string }
  if (!res.ok) {
    return { error: MENSAJES[res.error ?? ''] ?? 'No se pudo registrar tu respuesta.' }
  }

  if (input.decision === 'rejected') {
    await devolverAEditado(supabase, input.token, input.comment, input.name)
  }

  revalidatePath('/entregas')
  revalidatePath('/revision')
  return { ok: true }
}

const MENSAJES: Record<string, string> = {
  token_desconocido: 'Este enlace ya no existe.',
  ya_votado: 'Ya respondiste a este video.',
  vencido: 'Este enlace venció. Pídenos uno nuevo.',
  falta_comentario: 'Escribe qué hay que cambiar.',
  decision_invalida: 'Respuesta no válida.',
}

/**
 * Devuelve el video al editor con lo que el cliente pidió.
 *
 * El texto va a content_idea_activity con la acción que ya existía para
 * decisiones del cliente, y con user_id null: quien actúa no es un miembro del
 * equipo. La tarjeta lo lee del mismo sitio que las correcciones internas.
 */
async function devolverAEditado(
  supabase: NonNullable<ReturnType<typeof createPublicClient>>,
  token: string,
  comment: string,
  name: string,
) {
  // Por token y no por idea_id: así el cliente no puede pedir cambios sobre un
  // video que no es el suyo aunque conozca su id.
  const { error } = await supabase.rpc('entregas_client_rejected', {
    p_token: token,
    p_comment: comment.trim(),
    p_name: name.trim(),
  })
  if (error) console.error('[revision cliente] no se pudo devolver a Editado', error.message)
}
