import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ClientCadenceEditor } from './client-cadence-editor'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const updateClientCadence = vi.fn<(...a: unknown[]) => Promise<{ ok?: true; error?: string }>>(
  async () => ({ ok: true }),
)
vi.mock('@/lib/actions/client-cadence', () => ({
  updateClientCadence: (...a: unknown[]) => updateClientCadence(...a),
}))

let mockRole = 'owner'
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ role: mockRole }) }))

beforeEach(() => {
  cleanup()
  updateClientCadence.mockClear()
  mockRole = 'owner'
})

function renderEditor(
  props?: Partial<ComponentProps<typeof ClientCadenceEditor>>,
) {
  return render(
    <ClientCadenceEditor
      clientId="c1"
      initialDays={[1, 3]}
      initialTime="14:00"
      initialSchedule={{ '3': '18:30' }}
      initialTimezone="America/Puerto_Rico"
      {...props}
    />,
  )
}

describe('ClientCadenceEditor', () => {
  it('shows frequency from selected days, not an invented quota', () => {
    renderEditor()
    expect(screen.getByTestId('cadence-frequency')).toHaveTextContent('2 publicaciones / semana')
    expect(screen.getByTestId('cadence-summary')).toHaveTextContent('2/sem · Lun · Mié · 14:00 · Puerto Rico')
  })

  it('toggles a day and saves posting_days without inventing extras', async () => {
    renderEditor()
    fireEvent.click(screen.getByTestId('cadence-day-5'))
    await waitFor(() =>
      expect(updateClientCadence).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ posting_days: [1, 3, 5] }),
      ),
    )
  })

  it('saves the default time and timezone as the person set them', async () => {
    renderEditor({ initialDays: [1], initialTime: null, initialSchedule: {}, initialTimezone: null })
    fireEvent.change(screen.getByLabelText('Hora preferida'), { target: { value: '09:15' } })
    await waitFor(() => expect(updateClientCadence).toHaveBeenCalledWith('c1', { posting_time: '09:15' }))

    fireEvent.change(screen.getByLabelText('Zona horaria'), { target: { value: 'America/New_York' } })
    await waitFor(() =>
      expect(updateClientCadence).toHaveBeenCalledWith('c1', { posting_timezone: 'America/New_York' }),
    )
  })

  it('is read-only without cadence.edit', () => {
    mockRole = 'copy'
    renderEditor()
    expect(screen.getByTestId('cadence-day-1')).toBeDisabled()
    expect(screen.getByLabelText('Hora preferida')).toBeDisabled()
    expect(screen.getByLabelText('Zona horaria')).toBeDisabled()
  })

  it('shows Sin cadencia when no days are set', () => {
    renderEditor({ initialDays: [], initialTime: null, initialSchedule: {}, initialTimezone: null })
    expect(screen.getByTestId('cadence-frequency')).toHaveTextContent('Sin cadencia')
    expect(screen.getByTestId('cadence-summary')).toHaveTextContent('Sin cadencia')
    expect(screen.queryByText(/AM sugerido/i)).not.toBeInTheDocument()
  })
})
