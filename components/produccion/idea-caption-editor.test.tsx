/**
 * Tests for the caption editor (components/produccion/idea-caption-editor.tsx).
 *
 * Caption único: there is ONE caption per video that goes to ALL the client's
 * networks. The editor must NOT offer a per-platform selector, must say the
 * caption applies to all networks, and (when given the client's platforms)
 * show their badges. AI generation is gated by 'captions.use'.
 *
 * The auth context and server actions are mocked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { UserRole } from '@/lib/supabase/types'

const generateIdeaCaption = vi.fn(async () => ({ ok: true as const, caption: 'hola' }))
const saveIdeaCaption = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...a: unknown[]) => generateIdeaCaption(...(a as [])),
  saveIdeaCaption: (...a: unknown[]) => saveIdeaCaption(...(a as [])),
}))

let mockRole: UserRole | null = 'editor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { IdeaCaptionEditor } from './idea-caption-editor'

afterEach(() => cleanup())

describe('IdeaCaptionEditor — caption único', () => {
  it('states the caption applies to all networks and has no per-platform selector', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} />)
    expect(screen.getByText(/una caption para todas las redes/i)).toBeInTheDocument()
    // the old single-platform <Select> combobox must be gone
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('offers AI generation when the user has captions.use and idea is ready', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor
        ideaId="i1"
        initialCaption={null}
        hook="Gancho"
        visualBrief="Brief visual"
      />,
    )
    expect(screen.getByRole('button', { name: /generar desde la idea/i })).toBeInTheDocument()
  })

  it('disables AI generation until hook and visual brief exist', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="solo hook" />)
    expect(screen.getByRole('button', { name: /generar desde la idea/i })).toBeDisabled()
    expect(screen.getByText(/completa el hook y el brief visual/i)).toBeInTheDocument()
  })

  it('shows the client platform badges when provided', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} platforms={['instagram', 'tiktok']} />)
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tiktok/i)).toBeInTheDocument()
  })

  it('regenerates with the user feedback + the previous caption', async () => {
    mockRole = 'editor'
    generateIdeaCaption.mockClear()
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption viejo" hook="Gancho" visualBrief="Brief" />)
    // The feedback control only appears once a caption exists.
    const fb = screen.getByPlaceholderText(/qué cambiar/i)
    fireEvent.change(fb, { target: { value: 'más corto, sin emojis' } })
    fireEvent.click(screen.getByRole('button', { name: /regenerar con feedback/i }))
    await waitFor(() =>
      expect(generateIdeaCaption).toHaveBeenCalledWith('i1', {
        feedback: 'más corto, sin emojis',
        previousCaption: 'Caption viejo',
      }),
    )
  })

  it('hides the feedback control until there is a caption to revise', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" visualBrief="Brief" />)
    expect(screen.queryByRole('button', { name: /regenerar con feedback/i })).not.toBeInTheDocument()
  })
})
