import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AvatarSetupDialog } from './avatar-setup-dialog'

vi.mock('@/lib/actions/avatar', () => ({ setAvatarUrl: vi.fn(), uploadAvatar: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

describe('AvatarSetupDialog', () => {
  it('renders the creator with styles and an "Ahora no" postpone option', () => {
    render(<AvatarSetupDialog open onOpenChange={() => {}} name="Ana Lopez" email="ana@x.com" />)
    expect(screen.getByText('Pon tu foto')).toBeInTheDocument()
    expect(screen.getByText('Generar')).toBeInTheDocument()
    expect(screen.getByText('Subir foto')).toBeInTheDocument()
    expect(screen.getByText('Ilustrado')).toBeInTheDocument()
    expect(screen.queryByText('Iniciales')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ahora no/i })).toBeInTheDocument()
  })

  it('"Ahora no" closes and calls onLater', () => {
    const onOpenChange = vi.fn()
    const onLater = vi.fn()
    render(
      <AvatarSetupDialog open onOpenChange={onOpenChange} name="Ana" email="ana@x.com" onLater={onLater} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ahora no/i }))
    expect(onLater).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables "Guardar avatar" until an option is picked', () => {
    render(<AvatarSetupDialog open onOpenChange={() => {}} name="Ana" email="ana@x.com" />)
    expect(screen.getByRole('button', { name: /Guardar avatar/i })).toBeDisabled()
  })
})
