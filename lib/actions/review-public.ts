import 'server-only'
import { createPublicClient } from '@/lib/supabase/public'
import { r2PublicUrl } from '@/lib/integrations/r2'
import type { ReviewData } from '@/lib/utils/review-link-core'

/** Review payload plus the resolved public video URL (built server-side). */
export type ReviewLoad = ReviewData & { video_url: string | null }

/**
 * Load a review by its public token (unauthenticated). Calls the SECURITY
 * DEFINER RPC `get_review_by_token` (scoping enforced in-DB) and resolves the
 * edited video's R2 key into a permanent public URL. Returns null when the token
 * is unknown or the DB isn't reachable — the page turns that into a 404.
 */
export async function getReviewByToken(token: string): Promise<ReviewLoad | null> {
  if (!token) return null
  const supabase = createPublicClient()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_review_by_token', { p_token: token })
  if (error || !data) return null

  const review = data as ReviewData
  const video_url = review.edited_video_key ? r2PublicUrl(review.edited_video_key) : null
  return { ...review, video_url }
}
