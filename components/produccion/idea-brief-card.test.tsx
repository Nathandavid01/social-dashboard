/**
 * IdeaBriefCard — the collapsible "La idea" section on the idea detail page.
 * Once the idea is generated (hook + brief present) it starts collapsed so the
 * page stays compact; the header toggles it open.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { IdeaBriefCard } from './idea-brief-card'

beforeEach(cleanup)

describe('IdeaBriefCard', () => {
  it('always shows the "La idea" title', () => {
    render(<IdeaBriefCard hook="h" visualBrief="b" />)
    expect(screen.getByText('La idea')).toBeInTheDocument()
  })

  it('starts collapsed when the idea is generated (hook + brief), hiding the fields', () => {
    render(<IdeaBriefCard hook="Mi hook" visualBrief="Mi brief visual" />)
    // collapsed → field values not visible yet
    expect(screen.queryByText('Mi hook')).toBeNull()
    expect(screen.queryByText('Mi brief visual')).toBeNull()
  })

  it('expands to reveal the fields when the header is clicked', () => {
    render(<IdeaBriefCard hook="Mi hook" visualBrief="Mi brief visual" />)
    fireEvent.click(screen.getByRole('button', { name: /la idea/i }))
    expect(screen.getByText('Mi hook')).toBeInTheDocument()
    expect(screen.getByText('Mi brief visual')).toBeInTheDocument()
  })

  it('starts expanded when there is no brief yet (not generated)', () => {
    render(<IdeaBriefCard hook={null} visualBrief={null} />)
    expect(screen.getByText(/Sin brief adicional/)).toBeInTheDocument()
  })
})
