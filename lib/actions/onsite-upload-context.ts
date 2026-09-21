'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getOnsiteShots } from '@/lib/actions/onsite'
import {
  buildOnsiteUploadContext,
  type OnsiteRawVideoRow,
  type OnsiteUploadContext,
} from '@/lib/onsite/upload-context'

export async function listOnsiteRawVideos(
  ideaIds: string[],
): Promise<{ videos?: OnsiteRawVideoRow[]; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (ideaIds.length === 0) return { videos: [] }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('id, name, status, kind, idea_id')
    .in('idea_id', ideaIds)
    .eq('kind', 'raw')
    .neq('status', 'archived')

  if (error) return { error: error.message }
  return { videos: (data ?? []) as OnsiteRawVideoRow[] }
}

export async function getOnsiteUploadContext(
  sessionId: string,
): Promise<{ context?: OnsiteUploadContext; error?: string }> {
  try {
    await requirePermission('recording.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const shotsRes = await getOnsiteShots(sessionId)
  if (shotsRes.error) return { error: shotsRes.error }
  const shots = shotsRes.shots ?? []

  const videosRes = await listOnsiteRawVideos(shots.map((s) => s.id))
  if (videosRes.error) return { error: videosRes.error }

  const supabase = await createClient()
  const { data: session, error: sessionError } = await supabase
    .from('recording_sessions')
    .select('id, title, session_date, client:clients(name)')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) {
    return { error: sessionError?.message ?? 'Sesión no encontrada' }
  }

  const clientRaw = session.client as { name?: string } | { name?: string }[] | null
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw

  return {
    context: buildOnsiteUploadContext({
      sessionId,
      clientName: client?.name ?? 'Sin cliente',
      sessionTitle: session.title ?? '',
      sessionDate: session.session_date ?? '',
      shots,
      videos: videosRes.videos ?? [],
    }),
  }
}
