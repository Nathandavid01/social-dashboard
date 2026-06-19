import type { SupabaseClient } from '@supabase/supabase-js'
import { selectApprovedExamples, selectAvoidExamples, type ApprovedCaptionRow } from '@/lib/utils/caption-learning'

/**
 * A client's APPROVED captions, to feed back into the generator as the exact
 * standard to match (per-client learning loop). Pulls from BOTH places an
 * approved caption can live:
 *   - content_ideas (approval_status = 'approved')
 *   - idea_lab_feedback (verdict = 'approved', from the Idea Lab flow)
 *
 * Best-effort: each source is independent and Supabase errors surface as null
 * data (not a throw), so one source failing never kills the other and caption
 * generation never breaks.
 *
 * `excludeId` skips the row currently being generated for, so an already-approved
 * idea never feeds its own caption back as an example.
 */
export async function fetchApprovedCaptionExamples(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
  opts?: { excludeId?: string | null; limit?: number },
): Promise<string[]> {
  if (!clientId) return []
  const limit = opts?.limit ?? 6
  const excludeId = opts?.excludeId
  try {
    let ideasQuery = supabase
      .from('content_ideas')
      .select('generated_caption, caption_generated_at')
      .eq('client_id', clientId)
      .eq('approval_status', 'approved')
      .not('generated_caption', 'is', null)
    let labQuery = supabase
      .from('idea_lab_feedback')
      .select('generated_caption, created_at')
      .eq('client_id', clientId)
      .eq('verdict', 'approved')
      .not('generated_caption', 'is', null)
    // A caption id is unique across tables, so excluding from both is safe (the
    // non-matching table just no-ops).
    if (excludeId) {
      ideasQuery = ideasQuery.neq('id', excludeId)
      labQuery = labQuery.neq('id', excludeId)
    }

    const [ideas, lab] = await Promise.all([
      ideasQuery.order('caption_generated_at', { ascending: false }).limit(12),
      labQuery.order('created_at', { ascending: false }).limit(12),
    ])

    const rows: ApprovedCaptionRow[] = [
      ...((ideas.data ?? []) as { generated_caption: string | null; caption_generated_at: string | null }[]).map(
        (r) => ({ text: r.generated_caption, recency: r.caption_generated_at }),
      ),
      ...((lab.data ?? []) as { generated_caption: string | null; created_at: string | null }[]).map((r) => ({
        text: r.generated_caption,
        recency: r.created_at,
      })),
    ]
    return selectApprovedExamples(rows, limit)
  } catch {
    return []
  }
}

/**
 * Explicit 👍/👎 caption ratings for a client (fase 2). Returns the loved
 * captions (rating=1) as positive examples and the rejected ones (rating=-1,
 * with their note) as the "avoid" signal. Best-effort: returns empty on any
 * error (e.g. before migration 0041) so generation never breaks.
 */
export async function fetchCaptionFeedbackForPrompt(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
): Promise<{ loved: string[]; avoid: { text: string; note: string | null }[] }> {
  if (!clientId) return { loved: [], avoid: [] }
  try {
    const { data } = await supabase
      .from('caption_feedback')
      .select('caption_text, rating, note, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(40)

    const rows = (data ?? []) as { caption_text: string | null; rating: number; note: string | null; created_at: string | null }[]
    const loved = selectApprovedExamples(
      rows.filter((r) => r.rating === 1).map((r) => ({ text: r.caption_text, recency: r.created_at })),
    )
    const avoid = selectAvoidExamples(
      rows.filter((r) => r.rating === -1).map((r) => ({ text: r.caption_text, note: r.note, recency: r.created_at })),
    )
    return { loved, avoid }
  } catch {
    return { loved: [], avoid: [] }
  }
}
