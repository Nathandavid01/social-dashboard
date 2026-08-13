import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ActivityWorkspace } from './activity-workspace'

afterEach(() => cleanup())

describe('ActivityWorkspace', () => {
  it('hides the session tab from non-owners', () => {
    render(
      <ActivityWorkspace
        activity={[]}
        session={[]}
        members={[]}
        canViewSession={false}
        currentUserId="u1"
        day="2026-08-13"
      />,
    )
    expect(screen.queryByRole('tab', { name: /Sesión/ })).not.toBeInTheDocument()
    expect(screen.getByText('Aún no hay actividad registrada.')).toBeInTheDocument()
  })

  it('lets the owner open the session log', () => {
    render(
      <ActivityWorkspace
        activity={[]}
        session={[]}
        members={[{ id: 'u1', full_name: 'Eric Pérez' }]}
        canViewSession
        currentUserId="u1"
        day="2026-08-13"
      />,
    )
    const tab = screen.getByRole('tab', { name: /Sesión/ })
    fireEvent.click(tab)
    expect(
      screen.getByText('Aún no hay clicks ni páginas registradas para este día.'),
    ).toBeInTheDocument()
  })
})
