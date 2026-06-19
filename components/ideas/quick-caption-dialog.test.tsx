import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/lib/actions/idea-lab-captions', () => ({
  generateQuickCaption: vi.fn(async () => ({ ok: true, caption: 'x' })),
  sendQuickCaptionToMetricool: vi.fn(async () => ({ ok: true, scheduledFor: '2026-06-15T10:00:00' })),
}))
vi.mock('@/lib/actions/caption-feedback', () => ({
  rateCaption: vi.fn(async () => ({ ok: true })),
  getCaptionLearningStats: vi.fn(async () => ({ approved: 0, loved: 0, rejected: 0, suggestions: [] })),
  appendClientCaptionRule: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getQuickUploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k', publicUrl: 'https://pub/k' })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))

import { QuickCaptionDialog } from './quick-caption-dialog'

const clients = [
  { id: 'c1', name: 'Joe Gym', metricool_blog_id: 'blog-1' },
  { id: 'c2', name: 'Sin Metricool', metricool_blog_id: null },
]

afterEach(() => cleanup())

describe('QuickCaptionDialog', () => {
  it('renders the launcher button', () => {
    render(<QuickCaptionDialog clients={clients} />)
    expect(screen.getByText('Caption rápido')).toBeInTheDocument()
  })

  it('opens the dialog with the generate + send controls', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    expect(screen.getByText('Generar con IA')).toBeInTheDocument()
    expect(screen.getByText('Enviar a Metricool')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/promo de último minuto/i)).toBeInTheDocument()
  })

  it('explains it sends a scheduled draft and starts with send disabled', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    expect(screen.getByText(/borrador programado/i)).toBeInTheDocument()
    // No client/caption chosen yet → cannot send.
    expect(screen.getByRole('button', { name: /Enviar a Metricool/i })).toBeDisabled()
  })

  it('has no per-platform dropdown — one caption goes to all the client networks', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    // The old platform selector (showed "Instagram" / had a LinkedIn option) is gone.
    expect(screen.queryByText('Instagram')).toBeNull()
    expect(screen.queryByText('LinkedIn')).toBeNull()
  })

  it('lets you choose between draft and auto-publish (defaults to draft)', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    // Default → scheduled draft.
    expect(screen.getByText(/borrador programado/i)).toBeInTheDocument()
    // Switch to auto-publish → helper text changes.
    fireEvent.click(screen.getByRole('button', { name: /publicar automáticamente/i }))
    expect(screen.getByText(/se publicará automáticamente/i)).toBeInTheDocument()
    expect(screen.queryByText(/borrador programado/i)).toBeNull()
  })

  it('limits the date picker to today or later (min set)', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toBeTruthy()
    expect(dateInput.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('hides the feedback + rating controls until there is a caption', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    // No caption generated yet → no "Ajustar con feedback" / 👍 / 👎.
    expect(screen.queryByText(/ajustar con feedback/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /me gusta/i })).toBeNull()
  })

  it('offers a video upload control', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    expect(screen.getByText(/subir video/i)).toBeInTheDocument()
  })

  it('shows the selected video file name and lets you remove it', () => {
    render(<QuickCaptionDialog clients={clients} />)
    fireEvent.click(screen.getByText('Caption rápido'))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'reel-final.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)
    expect(screen.getByText('reel-final.mp4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /quitar video/i }))
    expect(screen.queryByText('reel-final.mp4')).toBeNull()
  })
})
