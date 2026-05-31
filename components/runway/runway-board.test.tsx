import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunwayBoard } from './runway-board'
import type { RunwayRowData } from './runway-row'

vi.mock('./runway-row', () => ({
  RunwayRow: ({ row }: { row: { clientName: string } }) => <tr><td>{row.clientName}</td></tr>,
}))

describe('RunwayBoard', () => {
  it('renders a row per client and the column headers', () => {
    const rows = [
      { clientId: 'c1', clientName: 'Acme' },
      { clientId: 'c2', clientName: 'Beta' },
    ] as unknown as RunwayRowData[]
    render(<RunwayBoard rows={rows} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Cadencia')).toBeInTheDocument()
  })

  it('shows an empty state when there are no clients', () => {
    render(<RunwayBoard rows={[]} />)
    expect(screen.getByText(/No hay clientes activos/i)).toBeInTheDocument()
  })
})
