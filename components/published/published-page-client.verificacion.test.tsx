import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PublishedPageClient } from './published-page-client'

/**
 * Fusión Publicados + Verificación (v4.2): /schedule-check vive como cuarto
 * tab de /published. El tab solo aparece con tasks.read.all.
 */

const perms = vi.hoisted(() => ({ has: true }))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => perms.has,
}))
vi.mock('@/components/metricool/schedule-calendar', () => ({
  ScheduleCalendar: () => <div data-testid="schedule-calendar" />,
}))
vi.mock('./published-feed', () => ({ PublishedFeed: () => <div data-testid="feed" /> }))
vi.mock('./content-calendar', () => ({ ContentCalendar: () => <div /> }))

describe('PublishedPageClient — tab Verificación', () => {
  it('con tasks.read.all: el tab existe y renderiza el calendario de verificación', () => {
    perms.has = true
    render(<PublishedPageClient clients={[]} />)
    const tabBtn = screen.getByRole('button', { name: /verificación/i })
    fireEvent.click(tabBtn)
    expect(screen.getByTestId('schedule-calendar')).toBeInTheDocument()
  })

  it('sin el permiso: el tab no aparece y el feed sigue siendo el default', () => {
    perms.has = false
    render(<PublishedPageClient clients={[]} />)
    expect(screen.queryByRole('button', { name: /verificación/i })).toBeNull()
    expect(screen.getByTestId('feed')).toBeInTheDocument()
  })
})
