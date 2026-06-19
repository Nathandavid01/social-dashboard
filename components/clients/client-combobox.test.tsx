import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ClientCombobox } from './client-combobox'

afterEach(() => cleanup())

const clients = [
  { id: 'c1', name: 'Pa Ya Auto Parts' },
  { id: 'c2', name: 'Joe Gym' },
  { id: 'c3', name: 'Sofá & Co' },
]

describe('ClientCombobox', () => {
  it('shows the selected client name when not editing', () => {
    render(<ClientCombobox clients={clients} value="c2" onChange={() => {}} />)
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Joe Gym')
  })

  it('opens the full list on focus and filters as you type', () => {
    render(<ClientCombobox clients={clients} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByText('Pa Ya Auto Parts')).toBeInTheDocument()
    expect(screen.getByText('Joe Gym')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'joe' } })
    expect(screen.getByText('Joe Gym')).toBeInTheDocument()
    expect(screen.queryByText('Pa Ya Auto Parts')).toBeNull()
  })

  it('selecting a result calls onChange with the client id', () => {
    const onChange = vi.fn()
    render(<ClientCombobox clients={clients} value="" onChange={onChange} />)
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sof' } })
    fireEvent.mouseDown(screen.getByText('Sofá & Co'))
    expect(onChange).toHaveBeenCalledWith('c3')
  })

  it('supports keyboard: ArrowDown + Enter selects the highlighted result', () => {
    const onChange = vi.fn()
    render(<ClientCombobox clients={clients} value="" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input) // opens, highlight 0 = Pa Ya
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // → index 1 = Joe Gym
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('c2')
  })

  it('closes on Escape', () => {
    render(<ClientCombobox clients={clients} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows "Sin resultados" when nothing matches', () => {
    render(<ClientCombobox clients={clients} value="" onChange={() => {}} />)
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument()
  })
})
