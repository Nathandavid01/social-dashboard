import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  IDEA_VERSION_SELECT,
  buildIdeaVersionSnapshot,
  type IdeaVersionReason,
} from '@/lib/ideas/idea-version-snapshot'

/**
 * Insert a version row with the PREVIOUS content_ideas values, then return its id.
 * Best-effort: failures are logged and return null so the primary mutation still runs.
 */
export async function snapshotIdeaBeforeUpdate(
  supabase: SupabaseClient,
  ideaId: string,
  reason: IdeaVersionReason,
  userId?: string | null,
): Promise<string | null> {
  try {
    let createdBy = userId
    if (createdBy === undefined) {
      const { data: { user } } = await supabase.auth.getUser()
      createdBy = user?.id ?? null
    }

    const { data: prev, error: readErr } = await supabase
      .from('content_ideas')
      .select(IDEA_VERSION_SELECT)
      .eq('id', ideaId)
      .single()

    if (readErr || !prev) {
      console.warn('[idea-versions] read previous failed:', readErr?.message ?? 'no row')
      return null
    }

    const snapshot = buildIdeaVersionSnapshot(prev as Record<string, unknown>)
    if (!snapshot) return null

    const { data: inserted, error: insertErr } = await supabase
      .from('content_idea_versions')
      .insert({
        content_idea_id: ideaId,
        snapshot,
        reason,
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.warn('[idea-versions] insert failed:', insertErr.message)
      return null
    }
    return (inserted?.id as string | undefined) ?? null
  } catch (err) {
    console.warn('[idea-versions] snapshot failed:', err instanceof Error ? err.message : err)
    return null
  }
}
