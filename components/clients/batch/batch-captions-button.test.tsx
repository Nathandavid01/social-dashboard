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
  async (
    _id: string,
    _opts?: { hermanos?: { titulo: string; caption: string }[] },
  ): Promise<{ caption?: string; error?: string }> => ({ caption: 'generado ✨' }),
)
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (id: string, opts?: { hermanos?: { titulo: string; caption: string }[] }) =>
    generateIdeaCaption(id, opts),
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
    title: `Video ${id}`,
    generated_caption: caption,
    caption_draft: draft,
    status: 'idea',
    approval_status: 'pending',
    published_at: null,
    hook: 'h',
    visual_brief: 'v',
    videos: { raw: [{ id: `raw-${id}`, status: 'uploaded' }], broll: [], edited: [] },
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
    expect(generateIdeaCaption).toHaveBeenCalledWith('a', expect.objectContaining({ hermanos: expect.any(Array) }))
    expect(generateIdeaCaption).toHaveBeenCalledWith('c', expect.objectContaining({ hermanos: expect.any(Array) }))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/2 borradores listos/i) }))
  })

  it('no pisa un borrador pendiente de revisar', async () => {
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null, 'borrador sin revisar')]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 1 borrador/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(generateIdeaCaption).toHaveBeenCalledTimes(1)
    expect(generateIdeaCaption).toHaveBeenCalledWith('a', expect.objectContaining({ hermanos: expect.any(Array) }))
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

  it('skips ideas that have no uploaded video', () => {
    const noFile = vid('empty', null)
    noFile.videos = { raw: [], broll: [], edited: [] }
    render(<BatchCaptionsButton videos={[noFile, vid('a', null)]} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /generar 1 borrador/i })).toBeInTheDocument()
  })

  it('renders nothing when every video already has a caption', () => {
    const { container } = render(<BatchCaptionsButton videos={[vid('a', 'listo')]} onDone={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('genera en secuencia acumulando hermanos: 0, luego 1, luego 2 (Pieza 1)', async () => {
    let n = 0
    generateIdeaCaption.mockImplementation(async () => {
      n++
      return { caption: `Caption número ${n}` }
    })
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null), vid('c', null)]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 3 borradores/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())

    expect(generateIdeaCaption).toHaveBeenCalledTimes(3)
    const calls = generateIdeaCaption.mock.calls
    expect(calls[0][1]?.hermanos).toEqual([])
    expect(calls[1][1]?.hermanos).toHaveLength(1)
    expect(calls[1][1]?.hermanos?.[0].caption).toBe('Caption número 1')
    expect(calls[2][1]?.hermanos).toHaveLength(2)
    expect(calls[2][1]?.hermanos?.map((h) => h.caption)).toEqual(['Caption número 1', 'Caption número 2'])
  })

  it('un video que falla no se cuenta como hermano de los siguientes', async () => {
    generateIdeaCaption
      .mockImplementationOnce(async () => ({ error: 'Falta la idea' }))
      .mockImplementationOnce(async () => ({ caption: 'segundo caption' }))
    const onDone = vi.fn()
    render(<BatchCaptionsButton videos={[vid('a', null), vid('b', null)]} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 2 borradores/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const calls = generateIdeaCaption.mock.calls
    expect(calls[1][1]?.hermanos).toEqual([])
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
