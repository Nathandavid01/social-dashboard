'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { requirePermission } from '@/lib/auth/server'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { DIAS_DE_VIGENCIA, type DecisionCliente } from '@/lib/entregas/client-review'

/**
 * El enlace de aprobación que se manda al cliente, para el flujo de Entregas.
 *
 * UN enlace por tarjeta, con todos sus videos dentro: mandarle cinco enlaces
 * por WhatsApp y explicarle cuál es cuál es peor para todos. Cada video se
 * aprueba o se rechaza por separado dentro del mismo enlace.
 *
 * Separado del flujo de Eric: su función filtra el video por su bucket y su
 * aprobación publica sola en Metricool. Aquí la aprobación para en Publicación.
 */

export interface VideoDelEnlace {
  ideaId: string
  titulo: string | null
  status: 'pending' | DecisionCliente
  comment: string | null
  reviewerName: string | null
  videoUrl: string | null
}

export interface EnlaceGuardado {
  token: string
  expiresAt: string
  createdAt: string
  videos: { ideaId: string; status: 'pending' | DecisionCliente; comment: string | null; reviewerName: string | null }[]
}

/**
 * Genera el enlace de UN video. El anterior de ese mismo video deja de valer:
 * uno viejo circulando por WhatsApp seguiría aceptando votos.
 *
 * Un enlace por video y no por cliente: la tarjeta es un video, así que el
 * enlace que sale de ella tiene que serlo también.
 */
export async function crearEnlaceCliente(input: {
  clientId: string
  ideaIds: string[]
}): Promise<{ token?: string; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (input.ideaIds.length === 0) return { error: 'No hay videos que aprobar.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Solo los que tienen video subido: el cliente vería una ficha vacía sin
  // entender por qué.
  const { data: conVideo } = await supabase
    .from('content_idea_videos')
    .select('idea_id')
    .in('idea_id', input.ideaIds)
    .eq('kind', 'edited')
    .eq('storage_provider', 'entregas-r2')
  const listos = Array.from(new Set((conVideo ?? []).map((v) => v.idea_id as string)))
  if (listos.length === 0) return { error: 'Ningún video de esta tarjeta está subido todavía.' }

  // Solo los enlaces de ESTE video, no los del cliente entero: cada video
  // tiene el suyo y regenerar uno no debe tumbar los demás.
  const { data: previos } = await supabase
    .from('entregas_client_review_items').select('review_id').in('idea_id', listos)
  const aBorrar = Array.from(new Set((previos ?? []).map((r) => r.review_id as string)))
  if (aBorrar.length) await supabase.from('entregas_client_reviews').delete().in('id', aBorrar)

  const expira = new Date()
  expira.setDate(expira.getDate() + DIAS_DE_VIGENCIA)

  const { data: review, error } = await supabase
    .from('entregas_client_reviews')
    .insert({ client_id: input.clientId, expires_at: expira.toISOString(), created_by: user?.id ?? null })
    .select('token, id')
    .single()
  if (error) return { error: error.message }

  const { error: itemsErr } = await supabase
    .from('entregas_client_review_items')
    .insert(listos.map((ideaId) => ({ review_id: review.id as string, idea_id: ideaId })))
  if (itemsErr) return { error: itemsErr.message }

  revalidatePath('/entregas')
  return { token: review.token as string }
}

/** El enlace vivo de un video, para pintarlo en su tarjeta. */
export async function getEnlaceCliente(
  ideaId: string,
): Promise<{ enlace?: EnlaceGuardado | null; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('entregas_client_review_items')
    .select('review_id')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!item) return { enlace: null }

  const { data, error } = await supabase
    .from('entregas_client_reviews')
    .select('token, expires_at, created_at, items:entregas_client_review_items(idea_id, status, comment, reviewer_name)')
    .eq('id', item.review_id as string)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { enlace: null }

  return {
    enlace: {
      token: data.token as string,
      expiresAt: data.expires_at as string,
      createdAt: data.created_at as string,
      videos: ((data.items ?? []) as Record<string, unknown>[]).map((i) => ({
        ideaId: i.idea_id as string,
        status: i.status as 'pending' | DecisionCliente,
        comment: (i.comment as string | null) ?? null,
        reviewerName: (i.reviewer_name as string | null) ?? null,
      })),
    },
  }
}

export interface RevisionPublica {
  clientName: string | null
  expiresAt: string
  videos: VideoDelEnlace[]
}

/**
 * Lo que ve el cliente. Sin login: el token es la credencial y el filtrado pasa
 * dentro de la función SECURITY DEFINER, no aquí.
 */
export async function getRevisionPublica(token: string): Promise<RevisionPublica | null> {
  if (!token) return null
  const supabase = createPublicClient()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_entregas_review', { p_token: token })
  if (error || !data) return null

  const r = data as Record<string, unknown>
  const videos = ((r.videos ?? []) as Record<string, unknown>[]).map((v) => {
    const key = (v.video_key as string | null) ?? null
    return {
      ideaId: v.idea_id as string,
      titulo: (v.titulo as string | null) ?? null,
      status: v.status as VideoDelEnlace['status'],
      comment: (v.comment as string | null) ?? null,
      reviewerName: (v.reviewer_name as string | null) ?? null,
      // El bucket de Entregas, no el de Eric: con el suyo el reproductor
      // saldría vacío aunque la clave fuera correcta.
      videoUrl: key ? entregasR2PublicUrl(key) : null,
    }
  })
  return {
    clientName: (r.client_name as string | null) ?? null,
    expiresAt: r.expires_at as string,
    videos,
  }
}

const MENSAJES: Record<string, string> = {
  token_desconocido: 'Este enlace ya no existe.',
  ya_votado: 'Ya respondiste a este video.',
  vencido: 'Este enlace venció. Pídenos uno nuevo.',
  falta_comentario: 'Escribe qué hay que cambiar.',
  decision_invalida: 'Respuesta no válida.',
  video_no_es_de_este_enlace: 'Ese video no pertenece a este enlace.',
}

/**
 * El voto del cliente sobre UN video del enlace.
 *
 * Aprobar NO publica: la tarjeta llega a Publicación y el envío a Metricool lo
 * sigue dando una persona. Rechazar devuelve ese video a Editado con el texto
 * del cliente — las dos cosas las hace la función en una sola operación, para
 * que un fallo de red no deje el voto guardado y la tarjeta sin volver.
 */
export async function votarRevisionPublica(input: {
  token: string
  ideaId: string
  decision: DecisionCliente
  comment: string
  name: string
}): Promise<{ ok?: true; error?: string }> {
  const supabase = createPublicClient()
  if (!supabase) return { error: 'No disponible' }

  const { data, error } = await supabase.rpc('submit_entregas_review', {
    p_token: input.token,
    p_idea_id: input.ideaId,
    p_decision: input.decision,
    p_comment: input.comment,
    p_name: input.name,
  })
  if (error) return { error: error.message }

  const res = (data ?? {}) as { ok?: boolean; error?: string }
  if (!res.ok) return { error: MENSAJES[res.error ?? ''] ?? 'No se pudo registrar tu respuesta.' }

  revalidatePath('/entregas')
  revalidatePath('/revision')
  return { ok: true }
}
