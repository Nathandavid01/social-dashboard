/**
 * Tests for the client review actions form (components/review/review-actions.tsx).
 *
 * Inc 3: the client can Aprobar / Rechazar / Comentar. Verifies each control
 * calls the right server action with the token + input, surfaces errors, and
 * disappears once the link is expired (writes are also blocked in-DB).
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ReviewActions } from './review-actions'

const submitReview = vi.fn()
const addComment = vi.fn()
vi.mock('@/lib/actions/review-client-actions', () => ({
  submitClientReviewAction: (...args: unknown[]) => submitReview(...args),
  addClientReviewCommentAction: (...args: unknown[]) => addComment(...args),
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

beforeEach(() => {
  submitReview.mockReset().mockResolvedValue({ ok: true, status: 'approved' })
  addComment.mockReset().mockResolvedValue({ ok: true })
  refresh.mockReset()
})
afterEach(() => cleanup())

const TOKEN = 'tok-123'

describe('ReviewActions', () => {
  it('renders decision buttons and a comment box when the link is live', () => {
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/escribe un comentario/i)).toBeInTheDocument()
  })

  it('renders nothing once the link is expired', () => {
    const { container } = render(
      <ReviewActions token={TOKEN} currentStatus="pending" expired={true} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('submits an approval with the token and the entered name', async () => {
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'María' } })
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(TOKEN, 'approved', 'María'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('submits a rejection', async () => {
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }))
    await waitFor(() => expect(submitReview).toHaveBeenCalledWith(TOKEN, 'rejected', ''))
  })

  it('sends a comment with the token, name and body', async () => {
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'María' } })
    fireEvent.change(screen.getByPlaceholderText(/escribe un comentario/i), {
      target: { value: 'Suban el volumen' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enviar comentario/i }))
    await waitFor(() =>
      expect(addComment).toHaveBeenCalledWith(TOKEN, 'María', 'Suban el volumen'),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('does not send an empty comment', async () => {
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    fireEvent.click(screen.getByRole('button', { name: /enviar comentario/i }))
    expect(addComment).not.toHaveBeenCalled()
  })

  it('surfaces an error returned by the decision action', async () => {
    submitReview.mockResolvedValueOnce({ error: 'Este link de revisión venció.' })
    render(<ReviewActions token={TOKEN} currentStatus="pending" expired={false} />)
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    await waitFor(() =>
      expect(screen.getByText(/Este link de revisión venció/)).toBeInTheDocument(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
