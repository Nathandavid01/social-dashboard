/**
 * Tests for the "Mi día" screen. The promise of this page is a number a person
 * can TRUST ("tienes 6 videos hoy") — so the tests guard the honesty of that
 * number and of the labels around it, not the markup.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MyDayView } from './my-day-view'
import { buildMyDay, type OwnedVideo } from '@/lib/utils/my-day-core'

afterEach(() => cleanup())

const TODAY = '2026-07-13'
const ME = 'user-me'

function video(over: Partial<OwnedVideo> & { id: string }): OwnedVideo {
  return {
    title: over.id,
    status: 'grabada',
    approval_status: 'pending',
    generated_caption: null,
    published_at: null,
    publish_date: null,
    metricool_post_id: null,
    posting_error: null,
    recording_date: null,
    videos: { raw: [], broll: [], edited: [] },
    ...over,
  } as unknown as OwnedVideo
}

function mine(over: Partial<OwnedVideo> & { id: string }): OwnedVideo {
  return video({
    production_task: { id: 't', status: 'pendiente', publish_date: TODAY, assigned_to_id: ME },
    ...over,
  })
}

const day = (videos: OwnedVideo[], capacity?: number | null) =>
  buildMyDay(videos, { today: TODAY, userId: ME, capacity })

describe('MyDayView', () => {
  it('leads with the count of what I have to do today', () => {
    render(
      <MyDayView
        day={day([mine({ id: 'a', publish_date: TODAY }), mine({ id: 'b', publish_date: TODAY })])}
        firstName="Eric"
      />,
    )
    expect(screen.getByText('Tienes 2 videos hoy')).toBeInTheDocument()
    expect(screen.getByText(/Hola, Eric/)).toBeInTheDocument()
  })

  it('shows the next action for each video, so nobody has to open it', () => {
    render(<MyDayView day={day([mine({ id: 'a', publish_date: TODAY })])} />)
    expect(screen.getByText(/genera el caption/i)).toBeInTheDocument()
  })

  it('separates overdue from today', () => {
    render(
      <MyDayView
        day={day([
          mine({ id: 'late', publish_date: '2026-07-01' }),
          mine({ id: 'now', publish_date: TODAY }),
        ])}
      />,
    )
    expect(screen.getByText(/Atrasados/)).toBeInTheDocument()
    expect(screen.getByText(/Para hoy/)).toBeInTheDocument()
  })

  it('warns when I am over my configured ceiling', () => {
    const d = day(
      [
        mine({ id: 'a', publish_date: TODAY }),
        mine({ id: 'b', publish_date: TODAY }),
        mine({ id: 'c', publish_date: TODAY }),
      ],
      2,
    )
    render(<MyDayView day={d} />)
    // Said twice on purpose: the badge next to the count, and the note that
    // explains by how much.
    expect(screen.getAllByText(/sobre tu tope/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1 de más/)).toBeInTheDocument()
  })

  it('says nothing about a ceiling when none is configured', () => {
    render(<MyDayView day={day([mine({ id: 'a', publish_date: TODAY })])} />)
    expect(screen.queryByText(/tope/i)).not.toBeInTheDocument()
  })

  // The number must never be inflated by work I can't move.
  it('does not count videos that are waiting on the client', () => {
    const d = day([
      mine({ id: 'mine', publish_date: TODAY }),
      mine({ id: 'client', approval_status: 'submitted', publish_date: '2026-07-01' }),
    ])
    render(<MyDayView day={d} />)
    expect(screen.getByText('Tienes 1 video hoy')).toBeInTheDocument()
    expect(screen.getByText(/Esperando a otros/)).toBeInTheDocument()
  })

  // Unassigned work must never read as "yours".
  it('says out loud when it is showing the team pool, not my work', () => {
    const d = buildMyDay([video({ id: 'free', publish_date: TODAY })], {
      today: TODAY,
      userId: ME,
    })
    render(<MyDayView day={d} />)
    expect(d.scope).toBe('equipo')
    expect(screen.getByText(/trabajo libre del equipo/i)).toBeInTheDocument()
  })

  it('congratulates instead of showing an empty list when my own work is done', () => {
    // Videos that are MINE but finished → scope stays 'mio', nothing to do.
    const d = day([mine({ id: 'done', published_at: '2026-07-01T00:00:00Z' })])
    render(<MyDayView day={d} firstName="Eric" />)
    expect(d.scope).toBe('mio')
    expect(screen.getByText(/nada pendiente para hoy/i)).toBeInTheDocument()
  })

  // A supervisor's review queue is THEIR work, not "esperando a otros".
  it('counts the review queue as my work when I can approve', () => {
    const d = buildMyDay(
      [mine({ id: 'r', approval_status: 'submitted', publish_date: TODAY })],
      { today: TODAY, userId: ME, canApprove: true },
    )
    render(<MyDayView day={d} />)
    expect(screen.getByText('Tienes 1 video hoy')).toBeInTheDocument()
    expect(screen.getByText('Aprobar')).toBeInTheDocument()
  })
})
