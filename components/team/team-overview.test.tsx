import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))
vi.mock('./role-selector', () => ({ RoleSelector: () => <div>role</div> }))
vi.mock('@/components/operations/task-status-badge', () => ({ TaskStatusBadge: () => <span>status</span> }))

import { TeamOverview } from './team-overview'

const member = (over: Record<string, unknown> = {}) => ({
  id: 'u1', full_name: 'Ana Torres', email: 'ana@x.com', role: 'editor', status: 'active',
  title: null, avatar_url: null, tasks: [], overdue: 0, ...over,
})

afterEach(() => cleanup())

describe('TeamOverview — video upload counts', () => {
  it('renders per-member raw / b-roll / edited upload counts', () => {
    render(<TeamOverview members={[member({ uploads: { raw: 3, broll: 1, edited: 2, total: 6 } })] as never} />)
    expect(screen.getByText('Videos subidos')).toBeInTheDocument()
    expect(screen.getByText('Raw 3')).toBeInTheDocument()
    expect(screen.getByText('B-roll 1')).toBeInTheDocument()
    expect(screen.getByText('Editados 2')).toBeInTheDocument()
  })

  it('omits the upload row when the member has no uploads', () => {
    render(<TeamOverview members={[member()] as never} />)
    expect(screen.queryByText('Videos subidos')).toBeNull()
  })
})
