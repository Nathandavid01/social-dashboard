import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ContentIdea } from '@/lib/supabase/types'
import { ClientBoardButton } from './client-board-button'

// Render the board as a marker carrying the props we care about.
vi.mock('@/components/clients/profile/pipeline-flow-board', () => ({
  PipelineFlowBoard: ({ ideas, canMove }: { ideas: ContentIdea[]; canMove?: boolean }) => (
    <div data-testid="board">board:{ideas.length}:{String(!!canMove)}</div>
  ),
}))

// Dialog (Radix) → render children inline only when open.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const canMove = vi.fn<() => boolean>()
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => canMove(),
}))

const ideas = [{ id: 'a' }, { id: 'b' }] as unknown as ContentIdea[]

beforeEach(() => {
  cleanup()
  canMove.mockReset()
  canMove.mockReturnValue(true)
})

describe('ClientBoardButton', () => {
  it('does not show the board until the button is clicked', () => {
    render(<ClientBoardButton clientName="Acme" ideas={ideas} />)
    expect(screen.queryByTestId('board')).not.toBeInTheDocument()
  })

  it('opens the board with the client ideas and the move permission', () => {
    render(<ClientBoardButton clientName="Acme" ideas={ideas} />)
    fireEvent.click(screen.getByRole('button', { name: /abrir board/i }))
    expect(screen.getByText('Flujo — Acme')).toBeInTheDocument()
    expect(screen.getByTestId('board')).toHaveTextContent('board:2:true')
  })

  it('passes canMove=false through when the user lacks planning.move', () => {
    canMove.mockReturnValue(false)
    render(<ClientBoardButton clientName="Acme" ideas={ideas} />)
    fireEvent.click(screen.getByRole('button', { name: /abrir board/i }))
    expect(screen.getByTestId('board')).toHaveTextContent('board:2:false')
  })
})
