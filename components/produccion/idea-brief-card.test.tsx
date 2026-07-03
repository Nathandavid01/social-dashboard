/**
 * IdeaBriefCard — simplified: ONE question ("¿De qué es este video?") drives
 * the AI caption; dates/brief/angle/hashtags hide behind "Más detalles
 * (opcional)". Fields persist via server actions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const updateIdeaBrief = vi.fn(async () => ({ success: true as const }))
const updateIdeaDates = vi.fn(async () => ({ success: true as const }))
vi.mock('@/lib/actions/content-ideas', () => ({
  updateIdeaBrief: (...a: unknown[]) => updateIdeaBrief(...(a as [])),
  updateIdeaDates: (...a: unknown[]) => updateIdeaDates(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { IdeaBriefCard } from './idea-brief-card'

beforeEach(() => {
  cleanup()
  updateIdeaBrief.mockClear()
  updateIdeaDates.mockClear()
})

describe('IdeaBriefCard — simple por defecto', () => {
  it('asks the one question that generates the caption', () => {
    render(<IdeaBriefCard ideaId="i1" />)
    expect(screen.getByText('¿De qué es este video?')).toBeInTheDocument()
    expect(screen.getByText(/la ai escribe el caption/i)).toBeInTheDocument()
  })

  it('shows the topic inline (no collapse hiding it)', () => {
    render(<IdeaBriefCard ideaId="i1" hook="Mi tema" visualBrief="Mi brief" />)
    expect(screen.getByText('Mi tema')).toBeInTheDocument()
  })

  it('hides the advanced fields until "Más detalles" is opened', () => {
    render(<IdeaBriefCard ideaId="i1" />)
    expect(screen.queryByText(/brief visual/i)).toBeNull()
    expect(screen.queryByText(/ángulo del caption/i)).toBeNull()
    expect(screen.queryByText(/fecha límite/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /más detalles/i }))
    expect(screen.getAllByText(/brief visual/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ángulo del caption/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/fecha límite/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/fecha de publicación/i).length).toBeGreaterThanOrEqual(1)
  })

  it('persists the edited topic via updateIdeaBrief (as the hook)', async () => {
    render(<IdeaBriefCard ideaId="i1" hook="Viejo tema" />)
    fireEvent.click(screen.getByRole('button', { name: /editar ¿de qué es este video\?/i }))
    const input = screen.getByLabelText('¿De qué es este video?')
    fireEvent.change(input, { target: { value: 'Nuevo tema' } })
    fireEvent.blur(input)
    await waitFor(() => expect(updateIdeaBrief).toHaveBeenCalledWith('i1', { hook: 'Nuevo tema' }))
  })

  it('persists the publish date via updateIdeaDates (inside Más detalles)', async () => {
    render(<IdeaBriefCard ideaId="i1" publishDate={null} />)
    fireEvent.click(screen.getByRole('button', { name: /más detalles/i }))
    fireEvent.click(screen.getByRole('button', { name: /editar fecha de publicación/i }))
    const input = screen.getByLabelText('Fecha de publicación')
    fireEvent.change(input, { target: { value: '2026-06-10' } })
    fireEvent.blur(input)
    await waitFor(() => expect(updateIdeaDates).toHaveBeenCalledWith('i1', { publish_date: '2026-06-10' }))
  })

  it('persists the deadline via updateIdeaDates (inside Más detalles)', async () => {
    render(<IdeaBriefCard ideaId="i1" deadline={null} />)
    fireEvent.click(screen.getByRole('button', { name: /más detalles/i }))
    fireEvent.click(screen.getByRole('button', { name: /editar fecha límite/i }))
    const input = screen.getByLabelText('Fecha límite')
    fireEvent.change(input, { target: { value: '2026-06-15' } })
    fireEvent.blur(input)
    await waitFor(() => expect(updateIdeaDates).toHaveBeenCalledWith('i1', { deadline: '2026-06-15' }))
  })
})
