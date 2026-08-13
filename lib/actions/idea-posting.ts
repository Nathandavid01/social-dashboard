'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { runIdeaPost, type PostResult } from '@/lib/actions/idea-posting-run'

type Result = PostResult

/** Emergency off-switch for the auto-on-approval behavior (manual button still works). */
const AUTOPOST_ON_APPROVAL_DISABLED = process.env.METRICOOL_AUTOPOST_ON_APPROVAL === 'false'

/**
 * Manual "Publicar a Metricool" — gated by `posting.publish`. Publishes a
 * fully-ready idea (caption + edited video + approved) on its planned date, or
 * at `scheduleOverride` ("YYYY-MM-DDTHH:MM", Puerto Rico wall-clock) when the
 * Publicación card picked a time by hand.
 */
export async function publishIdeaToMetricool(ideaId: string, scheduleOverride?: string | null): Promise<Result> {
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return runIdeaPost(supabase, ideaId, user?.id ?? null, scheduleOverride)
}

/** Outcome of the best-effort auto-post, so the approval UI can tell the user. */
export type AutoPostOutcome = { posted: boolean; skipped?: string } | null

/**
 * Best-effort auto-post triggered when an idea is approved. NEVER throws —
 * approval must succeed even if Metricool fails. Honors the
 * METRICOOL_AUTOPOST_ON_APPROVAL=false kill switch. Idempotent: a no-op if the
 * idea isn't fully ready or was already posted. Returns the outcome (posted /
 * why it was skipped) purely as UI feedback; null = kill-switched or errored.
 */
export async function maybeAutoPostIdea(
  ideaId: string,
  opts?: { videoFileId?: string | null },
): Promise<AutoPostOutcome> {
  if (AUTOPOST_ON_APPROVAL_DISABLED) return null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const res = await runIdeaPost(supabase, ideaId, user?.id ?? null, null, opts?.videoFileId)
    if (res.error) return null // recorded on the row; approval stays green
    if (res.skipped) return { posted: false, skipped: res.skipped }
    return { posted: true }
  } catch {
    /* swallow — approval already committed; the failure is recorded on the row */
    return null
  }
}
