import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

const updateClientBatchConfig = vi.fn(async () => ({ ok: true as const }))
const assignClient = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/client-batch', () => ({
  updateClientBatchConfig: (...a: unknown[]) => updateClientBatchConfig(...(a as [])),
  assignClient: (...a: unknown[]) => assignClient(...(a as [])),
}))

import { BatchSummaryBar } from './batch-summary-bar'

const members = [
  { id: 'u1', full_name: 'Nathan Torres' },
  { id: 'u2', full_name: 'Eric Pérez' },
]

beforeEach(() => {
  updateClientBatchConfig.mockClear()
  assignClient.mockClear()
})
afterEach(() => cleanup())

describe('BatchSummaryBar', () => {
  it('shows the three editable fields with defaults', () => {
    render(
      <BatchSummaryBar
        clientId="c1"
        videosCount={2}
        config={{ batchLabel: null, videosPerBatch: null }}
        members={members}
        assignee={null}
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('Lote')).toBeInTheDocument()
    expect(screen.getByText('Lote actual')).toBeInTheDocument()
    expect(screen.getByText('2 videos')).toBeInTheDocument()
    expect(screen.getByText('Encargado')).toBeInTheDocument()
    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
  })

  it('saves the LOTE label on edit + blur', () => {
    const onChanged = vi.fn()
    render(
      <BatchSummaryBar
        clientId="c1"
        videosCount={2}
        config={{ batchLabel: null, videosPerBatch: null }}
        members={members}
        assignee={null}
        onChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByText('Lote actual'))
    const input = screen.getByPlaceholderText('Nombre del lote')
    fireEvent.change(input, { target: { value: 'Junio 2026' } })
    fireEvent.blur(input)
    expect(updateClientBatchConfig).toHaveBeenCalledWith('c1', { batchLabel: 'Junio 2026' })
  })

  it('saves the videos-per-batch override on edit + blur (clamped 1..60)', () => {
    render(
      <BatchSummaryBar
        clientId="c1"
        videosCount={2}
        config={{ batchLabel: null, videosPerBatch: null }}
        members={members}
        assignee={null}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('2 videos'))
    const input = screen.getByDisplayValue('') // empty number input
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.blur(input)
    expect(updateClientBatchConfig).toHaveBeenCalledWith('c1', { videosPerBatch: 8 })
  })

  it('reflects an existing config (label + override)', () => {
    render(
      <BatchSummaryBar
        clientId="c1"
        videosCount={2}
        config={{ batchLabel: 'Q3', videosPerBatch: 10 }}
        members={members}
        assignee={{ id: 'u1', full_name: 'Nathan Torres' }}
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('Q3')).toBeInTheDocument()
    expect(screen.getByText('10 videos')).toBeInTheDocument()
  })
})
