import type { SupabaseClient } from '@supabase/supabase-js'
import { selectApprovedExamples, type ApprovedCaptionRow } from '@/lib/utils/caption-learning'

/**
 * A client's APPROVED captions, to feed back into the generator as the exact
 * standard to match (per-client learning loop). Pulls from BOTH places an
 * approved caption can live:
 *   - content_ideas (approval_status = 'approved')
 *   - idea_lab_feedback (verdict = 'approved', from the Idea Lab flow)
 *
 * Best-effort: Supabase errors surface as null data (e.g. before migration 0035
 * for idea_lab_feedback.generated_caption) and simply contribute nothing, so the
 * other source still works and caption generation never breaks.
 */
export async function fetchApprovedCaptionExamples(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
  limit = 6,
): Promise<string[]> {
  if (!clientId) return []
  try {
    const [ideas, lab] = await Promise.all([
      supabase
        .from('content_ideas')
        .select('generated_caption, caption_generated_at')
        .eq('client_id', clientId)
        .eq('approval_status', 'approved')
        .not('generated_caption', 'is', null)
        .order('caption_generated_at', { ascending: false })
        .limit(12),
      supabase
        .from('idea_lab_feedback')
        .select('generated_caption, created_at')
        .eq('client_id', clientId)
        .eq('verdict', 'approved')
        .not('generated_caption', 'is', null)
        .order('created_at', { ascending: false })
        .limit(12),
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
