import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { JornadaBoard } from './jornada-board'
import type { TeamTimeBoard } from '@/lib/actions/presence'
import type { RankedMember } from '@/lib/utils/presence-core'

afterEach(() => cleanup())

function member(over: Partial<RankedMember> & Pick<RankedMember, 'user_id' | 'full_name'>): RankedMember {
  return {
    avatar_url: null,
    today_seconds: 0,
    week_seconds: 0,
    last_beat_at: null,
    streak_days: 0,
    live: false,
    rank: 1,
    ...over,
  }
}

const board: TeamTimeBoard = {
  day: '2026-08-16',
  weekStart: '2026-08-10',
  team_week_seconds: 11 * 3600 + 20 * 60,
  live_count: 1,
  members: [
    member({
      user_id: 'r1', full_name: 'Richard Jimenez', rank: 1,
      today_seconds: 2 * 3600 + 14 * 60, week_seconds: 8 * 3600,
      live: true, streak_days: 5,
    }),
    member({
      user_id: 'e1', full_name: 'Eric Pérez', rank: 2,
      today_seconds: 3600, week_seconds: 3 * 3600 + 20 * 60,
    }),
  ],
}

describe('JornadaBoard', () => {
  it('enseña el total de la semana, el ranking y quién está en estudio', () => {
    render(<JornadaBoard board={board} currentUserId="e1" />)
    expect(screen.getByText('El estudio esta semana')).toBeInTheDocument()
    expect(screen.getByText('11h 20m')).toBeInTheDocument()
    expect(screen.getByText('Richard Jimenez')).toBeInTheDocument()
    expect(screen.getByText('Eric Pérez')).toBeInTheDocument()
    expect(screen.getByText('En estudio')).toBeInTheDocument()
    expect(screen.getByText(/racha 5d/)).toBeInTheDocument()
    expect(screen.getByText('tú')).toBeInTheDocument()
  })

  it('vacío: invita a entrar, no inventa horas', () => {
    render(
      <JornadaBoard
        board={{ day: '2026-08-16', weekStart: '2026-08-10', members: [], team_week_seconds: 0, live_count: 0 }}
        currentUserId="e1"
      />,
    )
    expect(screen.getByText(/Cuando el equipo entre/)).toBeInTheDocument()
  })
})
