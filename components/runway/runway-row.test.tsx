import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunwayRow, type RunwayRowData } from './runway-row'
import { computeRunway } from '@/lib/utils/content-runway'

vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))

function rowData(over: Partial<RunwayRowData> = {}): RunwayRowData {
  return {
    clientId: 'c1',
    clientName: 'Acme',
    logoUrl: null,
    weeklyCadence: 4,
    runway: computeRunway({ ideas: 12, porEditar: 8, porPublicar: 4, weeklyCadence: 4 }),
    ...over,
  }
}

function row(data: RunwayRowData) {
  return render(<table><tbody><RunwayRow row={data} /></tbody></table>)
}

describe('RunwayRow', () => {
  it('shows the client name, cadence, and the three stage bars in weeks', () => {
    row(rowData())
    expect(screen.getByRole('link', { name: /Acme/i })).toHaveAttribute('href', '/clients/c1')
    expect(screen.getByText('4/sem')).toBeInTheDocument()
    expect(screen.getByText('Ideas')).toBeInTheDocument()
    expect(screen.getByText('Grabado')).toBeInTheDocument()
    expect(screen.getByText('Editado')).toBeInTheDocument()
    expect(screen.getByText('3 sem')).toBeInTheDocument() // ideas = 12/4
    expect(screen.getByText('1 sem')).toBeInTheDocument() // edited = 4/4
  })

  it('shows the global status badge (risk when a stage < 2 weeks)', () => {
    row(rowData())
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
  })

  it('shows "Sin cadencia" and dashes when the client has no cadence', () => {
    row(rowData({ weeklyCadence: 0, runway: computeRunway({ ideas: 9, porEditar: 9, porPublicar: 9, weeklyCadence: 0 }) }))
    expect(screen.getByText('Sin cadencia')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})
