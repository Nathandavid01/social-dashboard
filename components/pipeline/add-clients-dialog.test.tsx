import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AddClientsToPipeline } from './add-clients-dialog'

const clients = [
  { id: 'c1', name: 'Bella Boutique' },
  { id: 'c2', name: 'Sabor Criollo' },
  { id: 'c3', name: 'FitZone PR' },
]

function setup() {
  const onAdd = vi.fn(async () => ({ created: 2 }))
  const onDone = vi.fn()
  render(<AddClientsToPipeline clients={clients} onAdd={onAdd} onDone={onDone} />)
  // open the dialog
  fireEvent.click(screen.getByRole('button', { name: /agregar clientes/i }))
  return { onAdd, onDone }
}

beforeEach(() => cleanup())

describe('AddClientsToPipeline', () => {
  it('lists every client as a selectable option', () => {
    setup()
    expect(screen.getByLabelText('Bella Boutique')).toBeTruthy()
    expect(screen.getByLabelText('Sabor Criollo')).toBeTruthy()
    expect(screen.getByLabelText('FitZone PR')).toBeTruthy()
  })

  it('keeps the add button disabled until at least one client is selected', () => {
    setup()
    const add = screen.getByRole('button', { name: /agregar al pipeline/i }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Bella Boutique'))
    expect(add.disabled).toBe(false)
  })

  it('submits the selected client ids and finishes', async () => {
    const { onAdd, onDone } = setup()
    fireEvent.click(screen.getByLabelText('Bella Boutique'))
    fireEvent.click(screen.getByLabelText('FitZone PR'))
    fireEvent.click(screen.getByRole('button', { name: /agregar al pipeline/i }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect((onAdd.mock.calls as unknown as string[][][])[0][0].sort()).toEqual(['c1', 'c3'])
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
