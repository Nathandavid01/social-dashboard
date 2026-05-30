/**
 * InlineEdit — reusable click-to-edit field (text / textarea / date) used across
 * editable flows. Saves on blur/Enter (optimistic), cancels on Escape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { InlineEdit } from './inline-edit'

beforeEach(cleanup)

describe('InlineEdit', () => {
  it('renders the current value', () => {
    render(<InlineEdit value="Hola" onSave={vi.fn(async () => ({}))} label="Hook" />)
    expect(screen.getByText('Hola')).toBeInTheDocument()
  })

  it('shows the placeholder when empty', () => {
    render(<InlineEdit value="" onSave={vi.fn(async () => ({}))} placeholder="Añadir hook" label="Hook" />)
    expect(screen.getByText('Añadir hook')).toBeInTheDocument()
  })

  it('enters edit mode and saves the new value on blur', async () => {
    const onSave = vi.fn(async () => ({}))
    render(<InlineEdit value="Hola" onSave={onSave} label="Hook" />)
    fireEvent.click(screen.getByRole('button', { name: /editar hook/i }))
    const input = screen.getByLabelText('Hook')
    fireEvent.change(input, { target: { value: 'Adiós' } })
    fireEvent.blur(input)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Adiós'))
    await waitFor(() => expect(screen.getByText('Adiós')).toBeInTheDocument())
  })

  it('does not save and reverts on Escape', () => {
    const onSave = vi.fn(async () => ({}))
    render(<InlineEdit value="Hola" onSave={onSave} label="Hook" />)
    fireEvent.click(screen.getByRole('button', { name: /editar hook/i }))
    const input = screen.getByLabelText('Hook')
    fireEvent.change(input, { target: { value: 'X' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Hola')).toBeInTheDocument()
  })

  it('does not call onSave when the value is unchanged', () => {
    const onSave = vi.fn(async () => ({}))
    render(<InlineEdit value="Hola" onSave={onSave} label="Hook" />)
    fireEvent.click(screen.getByRole('button', { name: /editar hook/i }))
    fireEvent.blur(screen.getByLabelText('Hook'))
    expect(onSave).not.toHaveBeenCalled()
  })
})
