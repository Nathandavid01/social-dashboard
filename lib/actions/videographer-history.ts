'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import {
  buildVideographerHistory,
  type HistoryIdeaInput,
  type HistoryVideoInput,
  type HistoryVideoKind,
  type VideographerHistorySession,
} from '@/lib/recording/videographer-history'
import type { UserRole } from '@/lib/supabase/types'

const VIDEO_LIMIT = 300
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface VideographerHistoryResult {
  sessions: VideographerHistorySession[]
  truncated: boolean
  error?: string
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Historial de grabación de una persona: videos que subió, por idea, y las
 * ideas que ella creó dentro de una sesión. Quien graba ve el suyo. Quien
 * tiene team.read ve el de cualquiera.
 */
export async function getVideographerHistory(personId: string): Promise<VideographerHistoryResult> {
  const empty = { sessions: [], truncated: false }
  if (!UUID.test(personId)) return { ...empty, error: 'Persona no válida' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: 'No autenticado' }
  if (user.id !== personId && !(await currentUserHas('team.read'))) {
    return { ...empty, error: 'No autorizado' }
  }

  const { data: videoRows, error: videoError } = await supabase
    .from('content_idea_videos')
    .select('id, name, kind, status, uploaded_by, uploaded_at, idea_id')
    .eq('uploaded_by', personId)
    .neq('status', 'archived')
    .order('uploaded_at', { ascending: false })
    .limit(VIDEO_LIMIT)
  if (videoError) return { ...empty, error: videoError.message }

  const videos = (videoRows ?? []) as Array<{
    id: string
    name: string | null
    kind: HistoryVideoKind
    status: string
    uploaded_by: string | null
    uploaded_at: string
    idea_id: string | null
  }>
  const ideaIds = [...new Set(videos.map((video) => video.idea_id).filter((id): id is string => !!id))]

  let ideaQuery = supabase
    .from('content_ideas')
    .select(`
      id, title, created_by, created_at, recording_session_id,
      client:clients!content_ideas_client_id_fkey(name),
      recording_session:recording_sessions!content_ideas_recording_session_id_fkey(title, session_date)
    `)
  ideaQuery = ideaIds.length > 0
    ? ideaQuery.or(`id.in.(${ideaIds.join(',')}),and(created_by.eq.${personId},recording_session_id.not.is.null)`)
    : ideaQuery.eq('created_by', personId).not('recording_session_id', 'is', null)

  const { data: ideaRows, error: ideaError } = await ideaQuery.limit(400)
  if (ideaError) return { ...empty, error: ideaError.message }

  const ideaInputs: HistoryIdeaInput[] = ((ideaRows ?? []) as Array<{
    id: string
    title: string | null
    created_by: string | null
    created_at: string
    recording_session_id: string | null
    client: { name: string | null } | { name: string | null }[] | null
    recording_session: { title: string | null; session_date: string | null } | { title: string | null; session_date: string | null }[] | null
  }>).map((row) => {
    const client = one(row.client)
    const session = one(row.recording_session)
    return {
      id: row.id,
      title: row.title,
      createdBy: row.created_by,
      createdAt: row.created_at,
      recordingSessionId: row.recording_session_id,
      clientName: client?.name ?? null,
      sessionTitle: session?.title ?? null,
      sessionDate: session?.session_date ?? null,
    }
  })

  const videoInputs: HistoryVideoInput[] = videos
    .filter((video) => !!video.idea_id)
    .map((video) => ({
      id: video.id,
      name: video.name ?? '',
      kind: video.kind,
      status: video.status,
      uploadedBy: video.uploaded_by,
      uploadedAt: video.uploaded_at,
      ideaId: video.idea_id as string,
    }))

  return {
    sessions: buildVideographerHistory(personId, videoInputs, ideaInputs),
    truncated: videos.length >= VIDEO_LIMIT,
  }
}

/** El historial de quien está viendo Mi día, solo si graba. */
export async function getOwnRecordingHistory(): Promise<VideographerHistoryResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((profile?.role as UserRole | undefined) !== 'video') return null
  return getVideographerHistory(user.id)
}
