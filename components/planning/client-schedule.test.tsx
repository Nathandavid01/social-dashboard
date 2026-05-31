/**
 * Tests for ClientSchedule (components/planning/client-schedule.tsx).
 *
 * Contract: rows with a scheduled idea link to the existing detail screen
 * /produccion/idea/[ideaId]; "Falta video" rows (no ideaId) are not links.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: vi.fn(async () => ({ caption: 'x' })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

// next/link renders a plain anchor in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

import { ClientSchedule, type ScheduleTask } from './client-schedule'

beforeEach(() => cleanup())

describe('ClientSchedule — row links to detail', () => {
  it('renders the idea title as a link to /produccion/idea/[ideaId]', () => {
    const tasks: ScheduleTask[] = [
      { publishDate: '2026-06-02', ideaId: 'idea-42', ideaTitle: 'Promo del finde', contentType: 'R', hasCaption: false, pipeline: null },
    ]
    render(<ClientSchedule postingDays={[]} tasks={tasks} />)
    const link = screen.getByRole('link', { name: /promo del finde/i })
    expect(link).toHaveAttribute('href', '/produccion/idea/idea-42')
  })

  it('does NOT render a link for a "Falta video" slot (no idea)', () => {
    // A cadence day with no scheduled idea → "Falta video", not a link.
    const tasks: ScheduleTask[] = [
      { publishDate: '2026-06-02', ideaId: 'idea-42', ideaTitle: 'Promo', contentType: 'R', hasCaption: false, pipeline: null },
    ]
    // postingDays includes a weekday that produces extra empty slots.
    render(<ClientSchedule postingDays={[0, 1, 2, 3, 4, 5, 6]} tasks={tasks} />)
    expect(screen.getAllByText(/falta video/i).length).toBeGreaterThan(0)
    // The only link present points to the scheduled idea, not to any empty slot.
    const links = screen.getAllByRole('link')
    expect(links.every((l) => l.getAttribute('href') === '/produccion/idea/idea-42')).toBe(true)
  })
})

describe('ClientSchedule — per-row status column', () => {
  const withIdea: ScheduleTask = {
    publishDate: '2026-06-02',
    ideaId: 'idea-42',
    ideaTitle: 'Promo',
    contentType: 'R',
    hasCaption: false,
    pipeline: {
      stages: Array.from({ length: 7 }, (_, i) => ({ key: `s${i}`, label: `Stage ${i}`, done: i < 3 })),
    } as any,
  }

  it('renders a 7-segment status bar for a slot that has an idea', () => {
    render(<ClientSchedule postingDays={[]} tasks={[withIdea]} />)
    expect(screen.getAllByTestId('stage-segment').length).toBeGreaterThanOrEqual(7)
  })

  it('renders no status bar for empty slots', () => {
    render(<ClientSchedule postingDays={[0, 1, 2, 3, 4, 5, 6]} tasks={[]} />)
    expect(screen.queryByTestId('stage-segment')).not.toBeInTheDocument()
    expect(screen.getAllByText(/falta video/i).length).toBeGreaterThan(0)
  })
})
