import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReviewPage } from '@/components/review/review-page'
import { getReviewByToken } from '@/lib/actions/review-public'

// Each token is unique and its data changes as the client acts — never cache.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

  return <ReviewPage review={review} nowISO={new Date().toISOString()} />
}
