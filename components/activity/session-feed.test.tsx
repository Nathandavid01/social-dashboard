import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SessionFeed } from './session-feed'
import type { UiEventLogEntry } from '@/lib/actions/ui-events'

function ev(over: Partial<UiEventLogEntry> = {}): UiEventLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    kind: 'click',
    path: '/entregas',
    label: 'Subir video',
    target: 'button',
    created_at: '2026-08-13T14:30:00.000Z',
    user: { id: 'u1', full_name: 'Eric Pérez' },
    ...over,
  }
}

const members = [
  { id: 'u1', full_name: 'Eric Pérez' },
  { id: 'u2', full_name: 'Nathan Torres' },
]

afterEach(() => cleanup())

describe('SessionFeed', () => {
  const events = [
    ev({ id: '1', user_id: 'u1', label: 'Subir video', kind: 'click' }),
    ev({ id: '2', user_id: 'u1', label: '/home', kind: 'navigate', path: '/home' }),
    ev({
      id: '3',
      user_id: 'u2',
      user: { id: 'u2', full_name: 'Nathan Torres' },
      label: 'Publicar',
    }),
  ]

  it('defaults to the current user and shows their clicks and pages', () => {
    render(<SessionFeed events={events} members={members} defaultUserId="u1" day="2026-08-13" />)
    expect(screen.getByText('Subir video')).toBeInTheDocument()
    expect(screen.getAllByText('/home').length).toBeGreaterThan(0)
    expect(screen.queryByText('Publicar')).not.toBeInTheDocument()
  })

  it('can switch to another person or everyone', () => {
    render(<SessionFeed events={events} members={members} defaultUserId="u1" day="2026-08-13" />)
    fireEvent.click(screen.getByRole('button', { name: /Nathan Torres/ }))
    expect(screen.getByText('Publicar')).toBeInTheDocument()
    expect(screen.queryByText('Subir video')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Todos/ }))
    expect(screen.getByText('Subir video')).toBeInTheDocument()
    expect(screen.getByText('Publicar')).toBeInTheDocument()
  })

  it('shows an empty state when that person has no session events today', () => {
    render(<SessionFeed events={[]} members={members} defaultUserId="u1" day="2026-08-13" />)
    expect(
      screen.getByText('Aún no hay clicks ni páginas registradas para este día.'),
    ).toBeInTheDocument()
  })
})
