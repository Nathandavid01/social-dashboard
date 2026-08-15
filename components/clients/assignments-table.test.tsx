import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AssignmentsTable } from './assignments-table'

const setClientAssignment = vi.fn(async (_input: unknown) => ({ ok: true as const }))
vi.mock('@/lib/actions/client-assignments', () => ({
  setClientAssignment: (input: unknown) => setClientAssignment(input),
}))

afterEach(() => {
  cleanup()
  setClientAssignment.mockClear()
})

const members = [
  { id: 'jeander', name: 'Jeander Loop', role: 'editor' },
  { id: 'lisneidy', name: 'Lisneidy Lopez', role: 'editor' },
  { id: 'joxandra', name: 'Joxandra Vilchez', role: 'disenador' },
  { id: 'idle', name: 'Sin cartera', role: 'editor' },
]

const clients = [
  { id: 'aa', name: 'AA Real Estate', assigned_to: 'jeander', assigned_designer: null },
  { id: 'beyond', name: 'Beyond PVC', assigned_to: 'jeander', assigned_designer: null },
  { id: 'blend', name: 'Blend Salon', assigned_to: 'lisneidy', assigned_designer: null },
  { id: 'bosque', name: 'Café El Bosque', assigned_to: 'lisneidy', assigned_designer: 'joxandra' },
  { id: 'anibal', name: 'Anibal Fuentes PNP', assigned_to: null, assigned_designer: null },
]

describe('AssignmentsTable', () => {
  it('shows chips only for people who already have clients', () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    expect(screen.getByRole('button', { name: /Jeander Loop/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lisneidy Lopez/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Joxandra Vilchez/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sin cartera/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sin asignar/ })).toBeInTheDocument()
  })

  it('groups Todos by editor and keeps Sin editor reachable', () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    expect(screen.getByRole('rowgroup', { name: 'Sin editor' })).toBeInTheDocument()
    expect(screen.getByRole('rowgroup', { name: 'Jeander Loop' })).toBeInTheDocument()
    expect(screen.getByText('Anibal Fuentes PNP')).toBeInTheDocument()
    expect(screen.getByText('AA Real Estate')).toBeInTheDocument()
  })

  it('filtering to an assigned person gathers their clients together', () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    fireEvent.click(screen.getByRole('button', { name: /Jeander Loop/ }))
    expect(screen.getByText('AA Real Estate')).toBeInTheDocument()
    expect(screen.getByText('Beyond PVC')).toBeInTheDocument()
    expect(screen.queryByText('Blend Salon')).not.toBeInTheDocument()
    expect(screen.queryByText('Anibal Fuentes PNP')).not.toBeInTheDocument()
  })

  it('Sin asignar still shows incomplete clients', () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    fireEvent.click(screen.getByRole('button', { name: /Sin asignar/ }))
    expect(screen.getByText('Anibal Fuentes PNP')).toBeInTheDocument()
    expect(screen.getByText('AA Real Estate')).toBeInTheDocument()
    expect(screen.queryByText('Café El Bosque')).not.toBeInTheDocument()
  })

  it('shows who last changed the row', () => {
    render(
      <AssignmentsTable
        clients={[
          {
            ...clients[4],
            assignment_changed_by: 'jeander',
            assignment_changed_at: '2026-08-13T14:00:00.000Z',
          },
        ]}
        members={members}
      />,
    )
    expect(screen.getByText(/Lo cambió Jeander Loop/)).toBeInTheDocument()
  })

  it('tints each editor group so they are visually distinct', () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    const jeander = screen.getByRole('rowgroup', { name: 'Jeander Loop' })
    const lisneidy = screen.getByRole('rowgroup', { name: 'Lisneidy Lopez' })
    expect(jeander.querySelector('[data-editor-tint]')?.getAttribute('data-editor-tint')).not.toBe(
      lisneidy.querySelector('[data-editor-tint]')?.getAttribute('data-editor-tint'),
    )
  })

  it('changing an editor still saves through setClientAssignment', async () => {
    render(<AssignmentsTable clients={clients} members={members} />)
    fireEvent.change(screen.getByLabelText('Editor de Anibal Fuentes PNP'), {
      target: { value: 'jeander' },
    })
    await waitFor(() =>
      expect(setClientAssignment).toHaveBeenCalledWith({
        clientId: 'anibal',
        campo: 'editor',
        userId: 'jeander',
      }),
    )
  })
})
