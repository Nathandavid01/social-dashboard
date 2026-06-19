/**
 * Tests for THE shared caption feedback module. It must behave identically
 * regardless of target (idea vs client): hide without a caption, regenerate
 * with feedback, and rate 👍/👎 against whatever target it's given.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const rateCaption = vi.fn(async () => ({ ok: true as const }))
const getCaptionLearningStats = vi.fn(async () => ({ approved: 0, loved: 0, rejected: 0, suggestions: [] as { phrase: string; count: number }[] }))
const appendClientCaptionRule = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/caption-feedback', () => ({
  rateCaption: (...a: unknown[]) => rateCaption(...(a as [])),
  getCaptionLearningStats: (...a: unknown[]) => getCaptionLearningStats(...(a as [])),
  appendClientCaptionRule: (...a: unknown[]) => appendClientCaptionRule(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))

import { CaptionFeedback } from './caption-feedback'

afterEach(() => cleanup())
beforeEach(() => {
  rateCaption.mockClear()
})

describe('CaptionFeedback (shared module)', () => {
  it('renders nothing without a caption', () => {
    const { container } = render(<CaptionFeedback caption="" target={{ ideaId: 'i1' }} onRegenerate={() => {}} isGenerating={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('regenerate with feedback calls onRegenerate with the typed text', () => {
    const onRegenerate = vi.fn()
    render(<CaptionFeedback caption="Un caption" target={{ ideaId: 'i1' }} onRegenerate={onRegenerate} isGenerating={false} />)
    fireEvent.change(screen.getByPlaceholderText(/qué cambiar/i), { target: { value: 'más corto' } })
    fireEvent.click(screen.getByRole('button', { name: /regenerar con feedback/i }))
    expect(onRegenerate).toHaveBeenCalledWith('más corto')
  })

  it('rates 👍 against an idea target', async () => {
    render(<CaptionFeedback caption="Un caption a calificar" target={{ ideaId: 'i1' }} onRegenerate={() => {}} isGenerating={false} />)
    fireEvent.click(screen.getByRole('button', { name: /me gusta/i }))
    await waitFor(() => expect(rateCaption).toHaveBeenCalledWith({ ideaId: 'i1', rating: 1, captionText: 'Un caption a calificar', note: undefined }))
  })

  it('rates against a CLIENT target (quick/approved captions, no idea row)', async () => {
    render(<CaptionFeedback caption="Un caption a calificar" target={{ clientId: 'c9' }} onRegenerate={() => {}} isGenerating={false} />)
    fireEvent.click(screen.getByRole('button', { name: /me gusta/i }))
    await waitFor(() => expect(rateCaption).toHaveBeenCalledWith({ clientId: 'c9', rating: 1, captionText: 'Un caption a calificar', note: undefined }))
  })
})
