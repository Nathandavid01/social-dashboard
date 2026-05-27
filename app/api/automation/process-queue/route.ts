import { NextRequest, NextResponse } from 'next/server'
import { processVideoReview, getApprovedVideoReviews } from '@/lib/automation/process-task'

// GET — list approved video reviews ready for caption generation
export async function GET() {
  const reviews = await getApprovedVideoReviews()
  return NextResponse.json({ count: reviews.length, reviews })
}

// POST — generate caption for one or all approved video reviews
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const videoReviewId = body.video_review_id

    // Single review
    if (videoReviewId) {
      const result = await processVideoReview(videoReviewId)
      return NextResponse.json(result)
    }

    // All approved reviews
    const reviews = await getApprovedVideoReviews()
    if (reviews.length === 0) {
      return NextResponse.json({ message: 'No approved videos in queue', results: [] })
    }

    const results = await Promise.allSettled(
      reviews.map((r) => processVideoReview(r.id))
    )

    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: String(r.reason) }
    )

    return NextResponse.json({ processed: reviews.length, results: summary })
  } catch (error) {
    console.error('Process queue error:', error)
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 })
  }
}
