import { getVideoReviews } from '@/lib/actions/video-reviews'
import { createClient } from '@/lib/supabase/server'
import { VideoReviewBoard } from '@/components/video-reviews/video-review-board'
import type { VideoReview, Client } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function VideoReviewsPage() {
  const supabase = await createClient()

  const [reviews, { data: clients }, { data: sentDrafts }] = await Promise.all([
    getVideoReviews().catch(() => [] as VideoReview[]),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('posting_drafts').select('video_review_id').eq('status', 'sent'),
  ])

  const sentReviewIds = (sentDrafts ?? []).map((d) => d.video_review_id as string)

  return (
    <VideoReviewBoard
      initialReviews={reviews as VideoReview[]}
      clients={(clients ?? []) as Pick<Client, 'id' | 'name'>[]}
      sentReviewIds={sentReviewIds}
    />
  )
}
