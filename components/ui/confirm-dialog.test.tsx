import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './confirm-dialog'

afterEach(() => cleanup())

describe('ConfirmDialog', () => {
  it('renders title + description and the confirm/cancel labels when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="¿Eliminar a Joe’s Gym?"
        description="No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('¿Eliminar a Joe’s Gym?')).toBeInTheDocument()
    expect(screen.getByText('No se puede deshacer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open onOpenChange={() => {}} title="t" confirmLabel="Eliminar" onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while loading', () => {
    render(
      <ConfirmDialog open onOpenChange={() => {}} title="t" confirmLabel="Eliminar" loading onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Eliminar/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} onOpenChange={() => {}} title="hidden title" onConfirm={() => {}} />)
    expect(screen.queryByText('hidden title')).toBeNull()
  })
})
