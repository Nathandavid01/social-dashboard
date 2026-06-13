import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/lib/actions/idea-lab-captions', () => ({
  generateQuickCaption: vi.fn(async () => ({ ok: true, caption: 'x' })),
  sendQuickCaptionToMetricool: vi.fn(async () => ({ ok: true, scheduledFor: '2026-06-15T10:00:00' })),
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
})
