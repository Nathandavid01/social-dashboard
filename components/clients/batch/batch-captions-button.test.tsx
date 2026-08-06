/**
 * Tests for the "Generar borradores del batch" button: one click drafts the
 * AI caption (same engine + learning as the idea generator) for every video
 * in the batch that doesn't have one yet — sequentially, with progress.
 *
 * Son BORRADORES: van a `caption_draft` y ninguno mueve el video de etapa.
 * Un video que ya tiene borrador pendiente tampoco se toca — regenerarlo
 * pisaría el texto que alguien está a punto de revisar.
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

function vid(id: string, caption: string | null, draft: string | null = null): BatchVideo {
  return {
    id,
    generated_caption: caption,
    caption_draft: draft,
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
    fireEvent.click(screen.getByRole('button', { name: /generar 2 borradores/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(generateIdeaCaption).toHaveBeenCalledTimes(2)
    expect(generateIdeaCaption).toHaveBeenCalledWith('a')
    expect(generateIdeaCaption).toHaveBeenCalledWith('c')
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/2 borradores listos/i) }))
  })

  it('no pisa un borrador pendiente de revisar', async () => {
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null, 'borrador sin revisar')]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 1 borrador/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(generateIdeaCaption).toHaveBeenCalledTimes(1)
    expect(generateIdeaCaption).toHaveBeenCalledWith('a')
  })

  it('el texto del botón deja claro que nada se envía', () => {
    render(<BatchCaptionsButton videos={[vid('a', null)]} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /generar 1 borrador/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generar 1 caption/i })).not.toBeInTheDocument()
  })

  it('keeps going when one video fails and reports the mix', async () => {
    generateIdeaCaption.mockImplementationOnce(async () => ({ error: 'Falta la idea' }))
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null)]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 2 borradores/i }))
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
    // El videógrafo ya no escribe captions: su trabajo termina al grabar.
    for (const role of ['video', 'disenador', null] as const) {
      mockRole = role
      const { container } = render(<BatchCaptionsButton videos={[vid('a', null)]} onDone={vi.fn()} />)
      expect(container.firstChild).toBeNull()
      cleanup()
    }
    mockRole = 'supervisor'
  })
})
