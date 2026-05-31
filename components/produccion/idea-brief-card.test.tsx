/**
 * IdeaBriefCard — the editable "La idea" step-1 card on the idea detail page.
 * Collapses once generated; fields (hook, brief, caption angle, hashtags) and the
 * publish date are editable inline and persist via server actions.
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

describe('IdeaBriefCard', () => {
  it('always shows the "La idea" title', () => {
    render(<IdeaBriefCard ideaId="i1" hook="h" visualBrief="b" />)
    expect(screen.getByText('La idea')).toBeInTheDocument()
  })

  it('starts collapsed when generated (hook + brief), hiding the fields', () => {
    render(<IdeaBriefCard ideaId="i1" hook="Mi hook" visualBrief="Mi brief" />)
    expect(screen.queryByText('Mi hook')).toBeNull()
  })

  it('expands and persists an edited field via updateIdeaBrief', async () => {
    render(<IdeaBriefCard ideaId="i1" hook="Mi hook" visualBrief="Mi brief" />)
    fireEvent.click(screen.getByRole('button', { name: /la idea/i })) // expand
    fireEvent.click(screen.getByRole('button', { name: /editar hook/i }))
    const input = screen.getByLabelText('Hook')
    fireEvent.change(input, { target: { value: 'Nuevo hook' } })
    fireEvent.blur(input)
    await waitFor(() => expect(updateIdeaBrief).toHaveBeenCalledWith('i1', { hook: 'Nuevo hook' }))
  })

  it('persists the publish date via updateIdeaDates', async () => {
    render(<IdeaBriefCard ideaId="i1" hook="h" visualBrief="b" publishDate={null} />)
    fireEvent.click(screen.getByRole('button', { name: /la idea/i })) // expand
    fireEvent.click(screen.getByRole('button', { name: /editar fecha de publicación/i }))
    const input = screen.getByLabelText('Fecha de publicación')
    fireEvent.change(input, { target: { value: '2026-06-10' } })
    fireEvent.blur(input)
    await waitFor(() => expect(updateIdeaDates).toHaveBeenCalledWith('i1', { publish_date: '2026-06-10' }))
  })
})
