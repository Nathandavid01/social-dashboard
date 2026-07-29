'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, currentUserHas } from '@/lib/auth/server'
import type { QueueVideo } from '@/components/review/review-queue'

/**
 * The videos behind one Revisión card. The board groups by client, but a
 * reviewer decides per video, so opening a card has to fetch the batch.
 *
 * Only `submitted` rows come back: a video already approved or sent back isn't
 * the reviewer's to act on, and showing it would put decisions on screen that
 * do nothing.
 */
export async function getEntregaReviewVideos(
  clientId: string,
): Promise<{ videos?: QueueVideo[]; error?: string }> {
  // Cualquiera de las dos pantallas del flujo: el editor vive en /revision y
  // el copy en /entregas, pero ambos necesitan mirar el mismo video.
  if (!(await currentUserHas('revision.read')) && !(await currentUserHas('entregas.read'))) {
    return { error: 'No autorizado' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_ideas')
    .select(
      'id, title, hook, approval_status, created_by, client:clients(name), videos:content_idea_videos(id, kind, storage_provider, uploaded_at)',
    )
    .eq('client_id', clientId)
    .eq('approval_status', 'submitted')
    .order('submitted_at', { ascending: true })

  if (error) return { error: error.message }

  const ids = (data ?? []).map((i) => i.created_by).filter(Boolean) as string[]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ids)
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? 'Alguien del equipo')
  }

  const rows = (data ?? []).filter((i) => {
    // Mismo criterio que el tablero: sin archivo editado en R2 no hay nada que
    // revisar. Antes entraban las filas de subidas fallidas y, como se ordena
    // por antigüedad, la cola abría justo en una de ellas — tarjeta sin video.
    const files = (i.videos ?? []) as { kind: string; storage_provider: string }[]
    return files.some((f) => f.kind === 'edited' && f.storage_provider === 'entregas-r2')
  })

  const videos: QueueVideo[] = rows.map((i) => {
    const files = (i.videos ?? []) as { id: string; kind: string; storage_provider: string; uploaded_at: string }[]
    // Newest edited file in R2 — re-uploads leave the older rows behind.
    const edited = files
      .filter((f) => f.kind === 'edited' && f.storage_provider === 'entregas-r2')
      .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))[0]

    const client = i.client as { name?: string } | null
    return {
      id: i.id,
      videoFileId: edited?.id ?? null,
      title: i.title?.trim() || i.hook?.trim() || 'Sin título',
      clientName: client?.name ?? 'Cliente',
      approval_status: i.approval_status,
      submitted_by: i.created_by,
      submittedByName: i.created_by ? names.get(i.created_by) ?? null : null,
    }
  })

  return { videos }
}
