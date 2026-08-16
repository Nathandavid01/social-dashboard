/**
 * Al abrir Copy en Entregas, si el video está listo y no hay texto,
 * se genera un borrador una vez. Un draft existente no se pisa.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { resetAutoDraftAttempts } from '@/lib/hooks/use-auto-draft-caption'
import type { CopyVideoRow } from '@/lib/actions/entregas-copy'

const generateIdeaCaption = vi.fn(async () => ({ ok: true as const, caption: 'copy solo' }))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...a: unknown[]) => generateIdeaCaption(...(a as [])),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregasPreviewUrl: vi.fn(async () => ({ url: 'https://v.test/v.mp4' })),
}))
const getEntregaCopyVideos = vi.fn()
const saveCopyAndSchedule = vi.fn(async (): Promise<{
  ok?: true
  error?: string
  autopost?: { posted: boolean; skipped?: string } | null
}> => ({ ok: true }))
vi.mock('@/lib/actions/entregas-copy', () => ({
  getEntregaCopyVideos: (...a: unknown[]) => getEntregaCopyVideos(...(a as [])),
  updateIdeaHook: vi.fn(async () => ({ ok: true as const })),
  saveClientCaptionNotes: vi.fn(async () => ({ ok: true as const })),
  saveCopyAndSchedule: (...a: unknown[]) => saveCopyAndSchedule(...(a as [])),
}))
const rateCaption = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/caption-feedback', () => ({
  rateCaption: (...a: unknown[]) => rateCaption(...(a as [])),
  getCaptionLearningStats: vi.fn(async () => ({ approved: 0, loved: 0, rejected: 0, suggestions: [] })),
  appendClientCaptionRule: vi.fn(async () => ({ ok: true as const })),
}))
const toast = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

// Mismo hook compartido que IdeaCaptionEditor (useVideoAnalysisPolling): por
// defecto, sin análisis (comportamiento de siempre); los tests de la sección
// "análisis visual" lo sobreescriben.
let mockAnalysis: { status: 'pending' | 'done' | 'error'; findings: { visual_summary?: string } | null } | null | undefined = null
vi.mock('@/lib/hooks/use-video-analysis-polling', () => ({
  useVideoAnalysisPolling: () => mockAnalysis,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: 'editor' }),
}))

import { CopyOverlay } from './copy-overlay'

function video(over: Partial<CopyVideoRow> = {}): CopyVideoRow {
  return {
    id: 'i1',
    videoFileId: 'f1',
    title: 'Socio baja 15 lb',
    clientName: 'Gym X',
    hook: 'Un socio cuenta cómo bajó 15 lb',
    visualBrief: null,
    captionAngle: null,
    hashtags: null,
    generated_caption: null,
    caption_draft: null,
    publishDate: null,
    platforms: ['instagram'],
    ...over,
  }
}

afterEach(() => {
  cleanup()
  generateIdeaCaption.mockClear()
  rateCaption.mockClear()
  saveCopyAndSchedule.mockClear()
  toast.mockClear()
  resetAutoDraftAttempts()
  mockAnalysis = null
})

describe('CopyOverlay — al abrir se escribe el copy solo', () => {
  it('genera una vez si hay video + tema y no hay copy', async () => {
    let resolveGen: (v: { ok: true; caption: string }) => void = () => {}
    generateIdeaCaption.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGen = resolve }),
    )
    getEntregaCopyVideos.mockResolvedValueOnce({ data: { videos: [video()], captionNotes: '' } })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    await waitFor(() => expect(getEntregaCopyVideos).toHaveBeenCalledWith('c1', 'i1'))
    expect(await screen.findByText(/escribiendo el copy/i)).toBeInTheDocument()
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledTimes(1))
    expect(generateIdeaCaption).toHaveBeenCalledWith('i1', { auto: true })
    resolveGen({ ok: true, caption: 'copy solo' })
    expect(await screen.findByDisplayValue('copy solo')).toBeInTheDocument()
  })

  it('no pisa un borrador que ya estaba', async () => {
    getEntregaCopyVideos.mockResolvedValueOnce({
      data: { videos: [video({ caption_draft: 'borrador de ayer' })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByDisplayValue('borrador de ayer')).toBeInTheDocument()
    await Promise.resolve()
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('no genera si falta el tema', async () => {
    getEntregaCopyVideos.mockResolvedValueOnce({
      data: { videos: [video({ hook: '' })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByText('Socio baja 15 lb')).toBeInTheDocument()
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })
})

/**
 * Entregas Copy es la SEGUNDA superficie viva de generación de captions
 * (además de IdeaCaptionEditor) y debe respetar el mismo criterio: sin hook
 * pero con análisis visual done, "Escribir copy con IA" genera igual.
 */
describe('CopyOverlay — el análisis visual reemplaza el hook', () => {
  it('sin tema pero con análisis visual done: genera al apretar el botón, sin el toast de bloqueo', async () => {
    mockAnalysis = { status: 'done', findings: { visual_summary: 'cocina picanha en parrilla, cierra con el logo' } }
    getEntregaCopyVideos.mockResolvedValueOnce({
      data: { videos: [video({ hook: '', caption_draft: null })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByText('Socio baja 15 lb')).toBeInTheDocument()
    // Sin hook + análisis listo también dispara el auto-borrador (mismo
    // criterio que shouldAutoDraftCaption); se espera a que asiente.
    await waitFor(() => expect(screen.getByDisplayValue('copy solo')).toBeInTheDocument())
    generateIdeaCaption.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /regenerar con ia/i }))
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledWith('i1', undefined))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/falta/i) }))
    // La etiqueta ya no marca el campo como obligatorio con "*" cuando la IA vio el video.
    expect(screen.getByText('¿De qué es el video?')).toBeInTheDocument()
  })

  it('sin tema y sin análisis: sigue bloqueando con el mensaje de siempre', async () => {
    mockAnalysis = { status: 'pending', findings: null }
    getEntregaCopyVideos.mockResolvedValueOnce({
      data: { videos: [video({ hook: '', caption_draft: null })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByText('Socio baja 15 lb')).toBeInTheDocument()
    expect(screen.getByText('¿De qué es el video? *')).toBeInTheDocument()
    generateIdeaCaption.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /escribir copy con ia/i }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/falta/i) })),
    )
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })
})

describe('CopyOverlay — 👍/👎 del caption único', () => {
  it('deja votar el copy y manda el voto de esa idea', async () => {
    getEntregaCopyVideos.mockResolvedValueOnce({
      data: { videos: [video({ caption_draft: 'Borrador largo para poder calificarlo ya' })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByDisplayValue('Borrador largo para poder calificarlo ya')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /me gusta/i }))
    await waitFor(() =>
      expect(rateCaption).toHaveBeenCalledWith({
        ideaId: 'i1',
        rating: 1,
        captionText: 'Borrador largo para poder calificarlo ya',
        note: undefined,
      }),
    )
  })
})

describe('CopyOverlay — Enviar a Publicación programa en Metricool', () => {
  it('dice que quedó programado cuando el copy ya puede publicarse', async () => {
    saveCopyAndSchedule.mockResolvedValueOnce({ ok: true as const, autopost: { posted: true } })
    getEntregaCopyVideos.mockResolvedValue({
      data: { videos: [video({ caption_draft: 'Copy listo para enviar ya mismo' })], captionNotes: '' },
    })
    render(<CopyOverlay clientId="c1" ideaId="i1" clientName="Gym X" onClose={() => {}} />)
    expect(await screen.findByDisplayValue('Copy listo para enviar ya mismo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /enviar a publicación/i }))
    await waitFor(() =>
      expect(saveCopyAndSchedule).toHaveBeenCalledWith(expect.objectContaining({
        ideaId: 'i1',
        videoFileId: 'f1',
      })),
    )
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/metricool/i),
    }))
  })
})
