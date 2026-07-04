/**
 * Tests for the public review page UI (components/review/review-page.tsx).
 *
 * Inc 2 is read-only: it must render the video, caption, client status, the
 * comment thread, and an honest expiry notice (read-only banner once expired).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReviewPage } from './review-page'
import type { ReviewData } from '@/lib/utils/review-link-core'

// NateLogo animates; stub it so the test focuses on review content.
vi.mock('@/components/shared/nate-logo', () => ({
  NateLogo: () => <span data-testid="logo" />,
}))

// ReviewActions is interactive (server actions + router); stub it so this stays
// a display test. It renders a marker only when the link is live (expired=false).
vi.mock('./review-actions', () => ({
  ReviewActions: ({ expired }: { expired: boolean }) =>
    expired ? null : <div data-testid="review-actions" />,
}))

afterEach(() => cleanup())

function baseReview(over: Partial<ReviewData & { video_url: string | null }> = {}) {
  const review: ReviewData & { video_url: string | null } = {
    idea_id: 'idea-1',
    title: 'Promo de verano',
    content_type: 'R',
    caption: 'Aprovecha el especial de julio 🌞',
    publish_date: '2026-07-10',
    client_name: 'Café Pinto',
    client_review_status: 'pending',
    client_reviewer_name: null,
    client_reviewed_at: null,
    expires_at: '2026-08-03T12:00:00Z',
    edited_video_key: 'edited/idea-1.mp4',
    video_url: 'https://videos.example/edited/idea-1.mp4',
    comments: [],
    ...over,
  }
  return review
}

const NOW = '2026-07-04T12:00:00Z'

describe('ReviewPage', () => {
  it('shows the client name, title and caption', () => {
    render(<ReviewPage review={baseReview()} token="tok-1" nowISO={NOW} />)
    expect(screen.getByText('Café Pinto')).toBeInTheDocument()
    expect(screen.getByText('Promo de verano')).toBeInTheDocument()
    expect(screen.getByText(/Aprovecha el especial de julio/)).toBeInTheDocument()
  })

  it('renders a video player when a public url is present', () => {
    const { container } = render(<ReviewPage review={baseReview()} token="tok-1" nowISO={NOW} />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('src', 'https://videos.example/edited/idea-1.mp4')
  })

  it('shows a fallback instead of a player when the video is not ready', () => {
    const { container } = render(
      <ReviewPage review={baseReview({ video_url: null, edited_video_key: null })} token="tok-1" nowISO={NOW} />,
    )
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByText(/El video todavía no está disponible/)).toBeInTheDocument()
  })

  it('shows the client review status label', () => {
    render(<ReviewPage review={baseReview({ client_review_status: 'approved' })} token="tok-1" nowISO={NOW} />)
    expect(screen.getByText('Aprobado por el cliente')).toBeInTheDocument()
  })

  it('shows days-left for a live link', () => {
    render(<ReviewPage review={baseReview()} token="tok-1" nowISO={NOW} />)
    expect(screen.getByText(/vence en 30 días/)).toBeInTheDocument()
  })

  it('shows a read-only banner once the link is expired', () => {
    render(
      <ReviewPage review={baseReview({ expires_at: '2026-07-01T12:00:00Z' })} token="tok-1" nowISO={NOW} />,
    )
    expect(screen.getByText(/venció/)).toBeInTheDocument()
    expect(screen.getByText(/ya no acepta cambios/)).toBeInTheDocument()
  })

  it('shows the action form on a live link', () => {
    render(<ReviewPage review={baseReview()} token="tok-1" nowISO={NOW} />)
    expect(screen.getByTestId('review-actions')).toBeInTheDocument()
  })

  it('hides the action form once the link is expired', () => {
    render(
      <ReviewPage review={baseReview({ expires_at: '2026-07-01T12:00:00Z' })} token="tok-1" nowISO={NOW} />,
    )
    expect(screen.queryByTestId('review-actions')).not.toBeInTheDocument()
  })

  it('renders the comment thread with author labels', () => {
    const review = baseReview({
      comments: [
        {
          id: 'c1',
          author_kind: 'client',
          author_name: 'María',
          body: 'Me encanta, pero suban el volumen.',
          created_at: '2026-07-04T15:00:00Z',
        },
        {
          id: 'c2',
          author_kind: 'staff',
          author_name: 'Nate',
          body: 'Listo, lo ajustamos.',
          created_at: '2026-07-04T16:00:00Z',
        },
      ],
    })
    render(<ReviewPage review={review} token="tok-1" nowISO={NOW} />)
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Equipo')).toBeInTheDocument()
    expect(screen.getByText(/suban el volumen/)).toBeInTheDocument()
    expect(screen.getByText(/lo ajustamos/)).toBeInTheDocument()
  })

  it('shows an empty state when there are no comments', () => {
    render(<ReviewPage review={baseReview()} token="tok-1" nowISO={NOW} />)
    expect(screen.getByText(/Aún no hay comentarios/)).toBeInTheDocument()
  })
})
