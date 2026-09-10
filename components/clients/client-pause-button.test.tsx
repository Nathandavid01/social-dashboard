import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const m = vi.hoisted(() => ({ allowed: true, pause: vi.fn(), activate: vi.fn(), refresh: vi.fn(), toast: vi.fn() }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => m.allowed }))
vi.mock('@/lib/actions/clients', () => ({ pauseClient: m.pause, activateClient: m.activate }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
import { ClientPauseButton } from './client-pause-button'
beforeEach(() => { vi.clearAllMocks(); m.allowed = true; m.pause.mockResolvedValue({ success: true }); m.activate.mockResolvedValue({ success: true }) })
it('ofrece pausar sin abrir un menú y después permite reactivar', async () => {
  render(<ClientPauseButton clientId="c1" clientName="Cliente" status="active" />)
  await userEvent.click(screen.getByRole('button', { name: 'Pausar cliente' }))
  await waitFor(() => expect(m.pause).toHaveBeenCalledWith('c1'))
  expect(screen.getByRole('button', { name: 'Reactivar cliente' })).toBeEnabled()
  expect(m.refresh).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Reactivar cliente' }))
  expect(m.activate).toHaveBeenCalledWith('c1')
})
it('restaura el estado si falla el guardado', async () => {
  m.pause.mockResolvedValue({ error: 'Sin conexión' })
  render(<ClientPauseButton clientId="c1" clientName="Cliente" status="active" />)
  await userEvent.click(screen.getByRole('button', { name: 'Pausar cliente' }))
  expect(screen.getByRole('button', { name: 'Pausar cliente' })).toBeEnabled()
  expect(m.refresh).not.toHaveBeenCalled()
  expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
})
it('no muestra el control a quien no puede editar clientes', () => {
  m.allowed = false
  render(<ClientPauseButton clientId="c1" clientName="Cliente" status="active" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('un cliente ya pausado tiene el botón para reactivarlo', () => {
  render(<ClientPauseButton clientId="c1" clientName="Cliente" status="paused" />)
  expect(screen.getByRole('button', { name: 'Reactivar cliente' })).toBeInTheDocument()
})

it('desactiva el botón mientras guarda para evitar cambios simultáneos', async () => {
  let finish!: (value: { success: boolean }) => void
  m.pause.mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<ClientPauseButton clientId="c1" clientName="Cliente" status="active" />)
  await userEvent.click(screen.getByRole('button', { name: 'Pausar cliente' }))
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  finish({ success: true })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reactivar cliente' })).toBeEnabled())
})
