import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ActivityWorkspace } from './activity-workspace'
import type { TeamTimeBoard } from '@/lib/actions/presence'

afterEach(() => cleanup())

const emptyBoard: TeamTimeBoard = {
  day: '2026-08-13',
  weekStart: '2026-08-10',
  members: [],
  team_week_seconds: 0,
  live_count: 0,
}

describe('ActivityWorkspace', () => {
  it('sin sesión ni pipeline: solo la Jornada, sin tabs', () => {
    render(
      <ActivityWorkspace
        activity={[]}
        session={[]}
        members={[]}
        canViewSession={false}
        canViewPipeline={false}
        board={emptyBoard}
        currentUserId="u1"
        day="2026-08-13"
      />,
    )
    expect(screen.queryByRole('tab', { name: /Sesión/ })).not.toBeInTheDocument()
    expect(screen.getByText('El estudio esta semana')).toBeInTheDocument()
  })

  it('el owner ve las tres pestañas: Jornada, Sesión y Pipeline', () => {
    render(
      <ActivityWorkspace
        activity={[]}
        session={[]}
        members={[{ id: 'u1', full_name: 'Eric Pérez' }]}
        canViewSession
        canViewPipeline
        board={emptyBoard}
        currentUserId="u1"
        day="2026-08-13"
      />,
    )
    expect(screen.getByRole('tab', { name: /Jornada/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sesión/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pipeline/ })).toBeInTheDocument()
    expect(screen.getByText('El estudio esta semana')).toBeInTheDocument()
  })
})
