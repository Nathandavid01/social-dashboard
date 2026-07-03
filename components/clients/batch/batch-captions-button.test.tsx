/**
 * Tests for the "Generar captions del batch" button: one click generates the
 * AI caption (same engine + learning as the idea generator) for every video
 * in the batch that doesn't have one yet — sequentially, with progress.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { UserRole } from '@/lib/supabase/types'

const generateIdeaCaption = vi.fn(
  async (_id: string): Promise<{ caption?: string; error?: string }> => ({ caption: 'generado ✨' }),
)
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (id: string) => generateIdeaCaption(id),
}))

let mockRole: UserRole | null = 'supervisor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))
const toast = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { BatchCaptionsButton } from './batch-captions-button'
import type { BatchVideo } from '@/lib/utils/batch-view'

function vid(id: string, caption: string | null): BatchVideo {
  return {
    id,
    generated_caption: caption,
    status: 'idea',
    approval_status: 'pending',
    published_at: null,
    hook: 'h',
    visual_brief: 'v',
    videos: { raw: [], broll: [], edited: [] },
  } as unknown as BatchVideo
}

afterEach(() => {
  cleanup()
  generateIdeaCaption.mockClear()
  toast.mockClear()
})

describe('BatchCaptionsButton', () => {
  it('generates captions ONLY for videos missing one, and reports the result', async () => {
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', 'ya tiene'), vid('c', null)]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 2 captions/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(generateIdeaCaption).toHaveBeenCalledTimes(2)
    expect(generateIdeaCaption).toHaveBeenCalledWith('a')
    expect(generateIdeaCaption).toHaveBeenCalledWith('c')
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/2 captions generados/i) }))
  })

  it('keeps going when one video fails and reports the mix', async () => {
    generateIdeaCaption.mockImplementationOnce(async () => ({ error: 'Falta la idea' }))
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null)]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 2 captions/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(generateIdeaCaption).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/1 fall(ó|aron)/i) }),
    )
  })

  it('renders nothing when every video already has a caption', () => {
    const { container } = render(<BatchCaptionsButton videos={[vid('a', 'listo')]} onDone={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing without captions.use permission', () => {
    mockRole = 'video'
    try {
      const { container } = render(<BatchCaptionsButton videos={[vid('a', null)]} onDone={vi.fn()} />)
      // video role DOES have captions.use since v2.83 — use a role that doesn't.
      expect(container.firstChild).not.toBeNull()
      cleanup()
      mockRole = null
      const { container: c2 } = render(<BatchCaptionsButton videos={[vid('a', null)]} onDone={vi.fn()} />)
      expect(c2.firstChild).toBeNull()
    } finally {
      mockRole = 'supervisor'
    }
  })
})
