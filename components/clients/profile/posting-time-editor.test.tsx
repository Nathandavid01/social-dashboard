import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PostingTimeEditor } from './posting-time-editor'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const updateClientProfile = vi.fn<(...a: unknown[]) => Promise<{ ok?: true; error?: string }>>(
  async () => ({ ok: true }),
)
vi.mock('@/lib/actions/client-profile', () => ({
  updateClientProfile: (...a: unknown[]) => updateClientProfile(...a),
}))

beforeEach(() => {
  cleanup()
  updateClientProfile.mockClear()
})

describe('PostingTimeEditor', () => {
  it('renders the default time and a per-day row for each posting day', () => {
    render(
      <PostingTimeEditor
        clientId="c1"
        postingDays={[1, 5]} // Mon, Fri
        initialTime="14:30"
        initialSchedule={{ '5': '18:00' }}
      />,
    )
    const inputs = screen.getAllByDisplayValue('14:30')
    expect(inputs.length).toBeGreaterThan(0) // default time shown
    expect(screen.getByText('Lunes')).toBeInTheDocument()
    expect(screen.getByText('Viernes')).toBeInTheDocument()
    expect(screen.getByDisplayValue('18:00')).toBeInTheDocument() // Fri override
  })

  it('persists a per-day override via updateClientProfile', async () => {
    render(
      <PostingTimeEditor
        clientId="c1"
        postingDays={[1]}
        initialTime="14:30"
        initialSchedule={{}}
      />,
    )
    // The Monday row input starts empty (default time '14:30' fills the other);
    // set an override on it.
    const monInput = screen.getAllByDisplayValue('')[0]
    fireEvent.change(monInput, { target: { value: '09:15' } })

    await waitFor(() =>
      expect(updateClientProfile).toHaveBeenCalledWith('c1', { posting_schedule: { '1': '09:15' } }),
    )
  })

  it('prompts to pick posting days when there are none', () => {
    render(<PostingTimeEditor clientId="c1" postingDays={[]} initialTime={null} initialSchedule={{}} />)
    expect(screen.getByText(/Selecciona días de posting/i)).toBeInTheDocument()
  })
})
