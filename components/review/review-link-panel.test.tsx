/**
 * Tests for the staff review-link panel (components/review/review-link-panel.tsx).
 *
 * Inc 4: staff mints/copies the client review link (gated on an edited video),
 * sees the client's vote + thread, and can reply.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ReviewLinkPanel } from './review-link-panel'

const generateReviewLink = vi.fn()
const getReviewStaffView = vi.fn()
const addStaffReviewComment = vi.fn()
vi.mock('@/lib/actions/review-staff', () => ({
  generateReviewLink: (...a: unknown[]) => generateReviewLink(...a),
  getReviewStaffView: (...a: unknown[]) => getReviewStaffView(...a),
  addStaffReviewComment: (...a: unknown[]) => addStaffReviewComment(...a),
}))

let canPublish = true
let canMove = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: (perm: string) =>
    perm === 'posting.publish' ? canPublish : canMove,
}))

const writeText = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  canPublish = true
  canMove = true
  generateReviewLink.mockReset().mockResolvedValue({
    url: 'https://app/review/tok-xyz',
    expiresAt: '2026-08-03T12:00:00Z',
  })
  getReviewStaffView.mockReset().mockResolvedValue({
    review_token: null,
    review_token_expires_at: null,
    client_review_status: 'pending',
    client_reviewer_name: null,
    client_reviewed_at: null,
    comments: [],
  })
  addStaffReviewComment.mockReset().mockResolvedValue({ ok: true })
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
})
afterEach(() => cleanup())

const IDEA = 'idea-1'

describe('ReviewLinkPanel', () => {
  it('hides the generate button and hints when there is no edited video', async () => {
    render(<ReviewLinkPanel ideaId={IDEA} hasEditedVideo={false} />)
    expect(screen.queryByRole('button', { name: /link de revisión/i })).not.toBeInTheDocument()
    expect(screen.getByText(/sube el video editado/i)).toBeInTheDocument()
  })

  it('generates the link and copies it to the clipboard', async () => {
    render(<ReviewLinkPanel ideaId={IDEA} hasEditedVideo={true} />)
    const btn = await screen.findByRole('button', { name: /link de revisión/i })
    fireEvent.click(btn)
    await waitFor(() => expect(generateReviewLink).toHaveBeenCalledWith(IDEA))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app/review/tok-xyz'))
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument()
  })

  it('does not show the generate button without posting.publish permission', () => {
    canPublish = false
    render(<ReviewLinkPanel ideaId={IDEA} hasEditedVideo={true} />)
    expect(screen.queryByRole('button', { name: /link de revisión/i })).not.toBeInTheDocument()
  })

  it('shows the client decision once the client has voted', async () => {
    getReviewStaffView.mockResolvedValue({
      review_token: 'tok-xyz',
      review_token_expires_at: '2026-08-03T12:00:00Z',
      client_review_status: 'rejected',
      client_reviewer_name: 'María',
      client_reviewed_at: '2026-07-04T15:00:00Z',
      comments: [
        {
          id: 'c1',
          author_kind: 'client',
          author_name: 'María',
          body: 'Suban el volumen',
          created_at: '2026-07-04T15:00:00Z',
        },
      ],
    })
    render(<ReviewLinkPanel ideaId={IDEA} hasEditedVideo={true} />)
    expect(await screen.findByText(/Rechazado por el cliente/i)).toBeInTheDocument()
    expect(await screen.findByText(/Suban el volumen/)).toBeInTheDocument()
  })

  it('lets staff reply in the thread', async () => {
    render(<ReviewLinkPanel ideaId={IDEA} hasEditedVideo={true} />)
    const box = await screen.findByPlaceholderText(/responder al cliente/i)
    fireEvent.change(box, { target: { value: 'Listo, lo ajustamos' } })
    fireEvent.click(screen.getByRole('button', { name: /responder/i }))
    await waitFor(() =>
      expect(addStaffReviewComment).toHaveBeenCalledWith(IDEA, 'Listo, lo ajustamos'),
    )
  })
})
