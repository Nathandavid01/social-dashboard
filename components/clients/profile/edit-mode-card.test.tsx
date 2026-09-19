import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateClientProfile = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/client-profile', () => ({
  updateClientProfile: (...a: unknown[]) => updateClientProfile(...(a as [])),
}))

import { EditModeCard } from './edit-mode-card'

beforeEach(() => {
  updateClientProfile.mockReset()
  updateClientProfile.mockResolvedValue({ ok: true })
})

describe('EditModeCard', () => {
  it('persists AI vs Editor humano', async () => {
    render(<EditModeCard clientId="c1" initialMode="human" />)
    fireEvent.click(screen.getByRole('button', { name: /AI/i }))
    await waitFor(() => expect(updateClientProfile).toHaveBeenCalledWith('c1', { edit_mode: 'ai' }))
    fireEvent.click(screen.getByRole('button', { name: /Editor humano/i }))
    await waitFor(() => expect(updateClientProfile).toHaveBeenCalledWith('c1', { edit_mode: 'human' }))
  })
})
