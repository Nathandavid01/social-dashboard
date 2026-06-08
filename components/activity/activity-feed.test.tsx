import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ActivityFeed } from './activity-feed'
import type { ActivityLogEntry } from '@/lib/actions/activity'

function entry(over: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    content_idea_id: 'i1',
    client_id: 'c1',
    user_id: 'u1',
    action: 'caption_generated',
    metadata: {},
    created_at: '2026-06-07T10:00:00Z',
    user: { id: 'u1', full_name: 'Eric Pérez' },
    idea: { id: 'i1', title: '612 de noche', content_type: 'C' },
    client: { id: 'c1', name: '612 C. Lounge' },
    ...over,
  } as ActivityLogEntry
}

const members = [
  { id: 'u1', full_name: 'Eric Pérez' },
  { id: 'u2', full_name: 'Nathan Torres' },
]

afterEach(() => cleanup())

describe('ActivityFeed', () => {
  const activity = [
    entry({ id: 'a', user_id: 'u1', user: { id: 'u1', full_name: 'Eric Pérez' }, action: 'caption_generated', metadata: { platform: 'instagram' } }),
    entry({ id: 'b', user_id: 'u1', user: { id: 'u1', full_name: 'Eric Pérez' }, action: 'video_uploaded', metadata: { kind: 'edited' } }),
    entry({ id: 'c', user_id: 'u2', user: { id: 'u2', full_name: 'Nathan Torres' }, action: 'recorded' }),
  ]

  it('shows who did what (person + verb + where)', () => {
    render(<ActivityFeed activity={activity} members={members} />)
    expect(screen.getAllByText('Eric Pérez').length).toBeGreaterThan(0)
    expect(screen.getByText(/generó el caption con IA \(instagram\)/)).toBeInTheDocument()
    expect(screen.getByText(/subió video \(edited\)/)).toBeInTheDocument()
    expect(screen.getByText('grabó el video')).toBeInTheDocument()
    // the "where" line: idea title · client
    expect(screen.getAllByText(/612 de noche · 612 C\. Lounge/).length).toBeGreaterThan(0)
  })

  it('shows a person filter with per-person counts and filters the feed', () => {
    render(<ActivityFeed activity={activity} members={members} />)
    // chips: Eric has 2, Nathan has 1
    const ericChip = screen.getByRole('button', { name: /Eric Pérez\s*2/ })
    const nathanChip = screen.getByRole('button', { name: /Nathan Torres\s*1/ })
    expect(ericChip).toBeInTheDocument()
    expect(nathanChip).toBeInTheDocument()

    // filter to Nathan → only his action remains
    fireEvent.click(nathanChip)
    expect(screen.getByText('grabó el video')).toBeInTheDocument()
    expect(screen.queryByText(/generó el caption con IA/)).not.toBeInTheDocument()
  })

  it('renders an empty state when there is no activity', () => {
    render(<ActivityFeed activity={[]} members={members} />)
    expect(screen.getByText('Aún no hay actividad registrada.')).toBeInTheDocument()
  })
})
