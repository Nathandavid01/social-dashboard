'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { ContentIdeaVideoKind, ContentIdeaVideoStatus } from '@/lib/supabase/types'

export interface VideoUploadLogItem {
  id: string
  ideaId: string
  ideaTitle: string
  clientId: string
  clientName: string
  name: string
  kind: ContentIdeaVideoKind
  status: ContentIdeaVideoStatus
  sizeBytes: number | null
  uploadedAt: string
}

export async function getMyVideoUploadLog(limit = 100): Promise<VideoUploadLogItem[]> {
  await requirePermission('video.upload')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('content_idea_videos')
    .select(`
      id, idea_id, name, kind, status, size_bytes, uploaded_at,
      idea:content_ideas!content_idea_videos_idea_id_fkey(
        id, title,
        client:clients!content_ideas_client_id_fkey(id, name)
      )
    `)
    .eq('uploaded_by', user.id)
    .order('uploaded_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250))

  if (error) {
    console.warn('[video-upload-log] fetch failed:', error.message)
    return []
  }

  return (data ?? []).map((raw) => {
    const row = raw as unknown as {
      id: string
      idea_id: string
      name: string
      kind: ContentIdeaVideoKind
      status: ContentIdeaVideoStatus
      size_bytes: number | null
      uploaded_at: string
      idea?: {
        id: string
        title: string | null
        client?: { id: string; name: string } | { id: string; name: string }[] | null
      } | {
        id: string
        title: string | null
        client?: { id: string; name: string } | { id: string; name: string }[] | null
      }[] | null
    }
    const idea = Array.isArray(row.idea) ? row.idea[0] : row.idea
    const client = Array.isArray(idea?.client) ? idea.client[0] : idea?.client

    return {
      id: row.id,
      ideaId: row.idea_id,
      ideaTitle: idea?.title?.trim() || 'Video sin título',
      clientId: client?.id ?? '',
      clientName: client?.name ?? 'Cliente desconocido',
      name: row.name,
      kind: row.kind,
      status: row.status,
      sizeBytes: row.size_bytes,
      uploadedAt: row.uploaded_at,
    }
  })
}
