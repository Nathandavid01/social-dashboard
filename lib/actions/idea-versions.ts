'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { IdeaVersionSnapshot } from '@/lib/ideas/idea-version-snapshot'

export interface IdeaVersionRow {
  id: string
  contentIdeaId: string
  snapshot: IdeaVersionSnapshot
  reason: string
  createdBy: string | null
  createdAt: string
  creatorName?: string | null
}

/** Historial de versiones de una idea (más reciente primero). */
export async function listIdeaVersions(
  ideaId: string,
): Promise<{ versions?: IdeaVersionRow[]; error?: string }> {
  try {
    await requirePermission('ideas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_versions')
    .select('id, content_idea_id, snapshot, reason, created_by, created_at, creator:profiles!created_by(id, full_name)')
    .eq('content_idea_id', ideaId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    const { data: plain, error: plainErr } = await supabase
      .from('content_idea_versions')
      .select('id, content_idea_id, snapshot, reason, created_by, created_at')
      .eq('content_idea_id', ideaId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (plainErr) return { error: plainErr.message }
    return {
      versions: (plain ?? []).map(mapPlainVersion),
    }
  }

  return {
    versions: (data ?? []).map((v) => {
      const creator = Array.isArray(v.creator) ? v.creator[0] : v.creator
      const c = creator as { full_name?: string } | null | undefined
      return {
        ...mapPlainVersion(v),
        creatorName: c?.full_name ?? null,
      }
    }),
  }
}

function mapPlainVersion(v: Record<string, unknown>): IdeaVersionRow {
  return {
    id: v.id as string,
    contentIdeaId: v.content_idea_id as string,
    snapshot: v.snapshot as IdeaVersionSnapshot,
    reason: v.reason as string,
    createdBy: (v.created_by as string | null) ?? null,
    createdAt: v.created_at as string,
  }
}
