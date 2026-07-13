import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReviewPage } from '@/components/review/review-page'
import { getReviewByToken } from '@/lib/actions/review-public'

// Each token is unique and its data changes as the client acts — never cache.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// The client's vote runs the auto-post inline (video health check + the Metricool
// call). On the default 10s budget a slow Metricool would kill the function
// mid-flight — possibly AFTER the post was created — leaving the row claimed and
// the client staring at an error for a vote that was actually saved.
export const maxDuration = 60

export const metadata: Metadata = {
  title: 'Revisión de contenido | NMedia PR',
  robots: { index: false, follow: false },
}

export default async function ReviewLinkPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const review = await getReviewByToken(token)
  if (!review) notFound()

  return <ReviewPage review={review} token={token} nowISO={new Date().toISOString()} />
}
