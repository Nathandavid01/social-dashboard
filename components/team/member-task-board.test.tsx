/**
 * Tests for MemberTaskBoard header: videos assigned to a person and not yet
 * submitted are counted as open work (derived automatically, no task rows).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/supabase/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/tasks', () => ({
  createTask: vi.fn(async () => ({ ok: true })),
  updateTaskStatus: vi.fn(async () => ({ ok: true })),
  deleteTask: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { MemberTaskBoard } from './member-task-board'

const member = { id: 'm1', email: 'n@x.com', full_name: 'Nathan Torres' } as Profile

beforeEach(cleanup)

describe('MemberTaskBoard open-work header', () => {
  it('counts assigned-not-submitted videos as open work', () => {
    render(<MemberTaskBoard member={member} initialTasks={[]} clients={[]} teamMembers={[]} assignedVideoCount={2} />)
    expect(screen.getByText(/2 videos por trabajar/)).toBeInTheDocument()
  })

  it('omits the video count when there are none', () => {
    render(<MemberTaskBoard member={member} initialTasks={[]} clients={[]} teamMembers={[]} assignedVideoCount={0} />)
    expect(screen.queryByText(/por trabajar/)).toBeNull()
  })
})
