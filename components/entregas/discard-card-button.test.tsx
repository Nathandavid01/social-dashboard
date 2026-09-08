import type { UserRole } from '@/lib/supabase/types'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ role: 'supervisor' as UserRole, discard: vi.fn(), refresh: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ role: h.role }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))
vi.mock('@/lib/actions/pipeline-submit', () => ({ discardEntregaVideos: h.discard }))
import { DiscardCardButton } from './discard-card-button'
beforeEach(() => { vi.clearAllMocks(); h.role = 'supervisor' })
async function confirm() {
  render(<DiscardCardButton ideaIds={['a','b']} clientName="Cliente" />)
  fireEvent.click(screen.getByRole('button'))
  await act(async () => { fireEvent.click(screen.getByRole('button')) })
}
it('refreshes after a partial discard and explains the preserved work', async () => {
  h.discard.mockResolvedValue({ count: 1, error: 'Se quitó 1; el otro tiene un envío pendiente.' })
  await confirm()
  await waitFor(() => expect(h.refresh).toHaveBeenCalled())
  expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('pendiente') }))
})
it('unlocks the button after a transport failure without reporting success', async () => {
  h.discard.mockRejectedValue(Error('transport'))
  await confirm()
  await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
  expect(screen.getByRole('button')).not.toBeDisabled()
})

it.each(['editor','video','disenador','copy','team_member'] as const)('hides discard from %s', role => {
  h.role = role
  render(<DiscardCardButton ideaIds={['a']} clientName="Cliente" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
