import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { ContentIdeaActivity, ContentIdeaActivityAction } from '@/lib/supabase/types'

/**
 * Append a row to the content_idea_activity audit log. Best-effort: a failure
 * here must never break the primary action, so errors are swallowed (logged).
 *
 * The caller passes the supabase client it already created (server actions
 * each build their own). client_id is resolved from the idea when not given.
 */
export async function logIdeaActivity(
  supabase: SupabaseClient,
  params: {
    ideaId: string
    action: ContentIdeaActivityAction
    clientId?: string | null
    userId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    let userId = params.userId
    if (userId === undefined) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }

    let clientId = params.clientId ?? null
    if (!clientId) {
      const { data } = await supabase
        .from('content_ideas')
        .select('client_id')
        .eq('id', params.ideaId)
        .single()
      clientId = (data?.client_id as string | undefined) ?? null
    }

    const { error } = await supabase.from('content_idea_activity').insert({
      content_idea_id: params.ideaId,
      client_id: clientId,
      user_id: userId,
      action: params.action,
      metadata: params.metadata ?? {},
    })
    if (error) console.warn('[idea-activity] insert failed:', error.message)
  } catch (err) {
    console.warn('[idea-activity] log failed:', err instanceof Error ? err.message : err)
  }
}

/** Full activity log for one idea, newest first, with the actor's name. */
export async function getIdeaActivity(ideaId: string): Promise<ContentIdeaActivity[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_activity')
    .select('*, user:profiles(id, full_name)')
    .eq('content_idea_id', ideaId)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[idea-activity] read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as ContentIdeaActivity[]
}
