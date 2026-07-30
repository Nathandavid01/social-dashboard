import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Client } from '@/lib/supabase/types'

const pauseClient = vi.fn(async (_id: string) => ({ success: true }) as { success?: boolean; error?: string })
const activateClient = vi.fn(async (_id: string) => ({ success: true }) as { success?: boolean; error?: string })
const deleteClient = vi.fn(async (_id: string) => ({ success: true }) as { success?: boolean; error?: string })

vi.mock('@/lib/actions/clients', () => ({
  pauseClient: (id: string) => pauseClient(id),
  activateClient: (id: string) => activateClient(id),
  deleteClient: (id: string) => deleteClient(id),
}))

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { ClientTable } from './client-table'

const cliente = (over: Partial<Client> = {}): Client => ({
  id: 'c1',
  name: 'Barber Lab',
  status: 'active',
  platforms: ['instagram'],
  industry: null,
  assigned_to: null,
  notes: null,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
} as Client)

async function abrirMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /acciones/i })[0])
}

beforeEach(() => {
  pauseClient.mockClear()
  activateClient.mockClear()
  deleteClient.mockClear()
})

describe('ClientTable — pausar', () => {
  it('un cliente activo ofrece pausar', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente()]} />)
    await abrirMenu(user)
    expect(await screen.findByText('Pausar')).toBeInTheDocument()
  })

  it('pausar llama a la acción con el id del cliente', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente({ id: 'abc' })]} />)
    await abrirMenu(user)
    await user.click(await screen.findByText('Pausar'))
    await waitFor(() => expect(pauseClient).toHaveBeenCalledWith('abc'))
    expect(deleteClient).not.toHaveBeenCalled()
  })

  it('un cliente pausado ofrece reactivar, no pausar', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente({ status: 'paused' })]} />)
    await abrirMenu(user)
    expect(await screen.findByText('Reactivar')).toBeInTheDocument()
    expect(screen.queryByText('Pausar')).not.toBeInTheDocument()
  })

  it('reactivar llama a activateClient', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente({ id: 'xyz', status: 'paused' })]} />)
    await abrirMenu(user)
    await user.click(await screen.findByText('Reactivar'))
    await waitFor(() => expect(activateClient).toHaveBeenCalledWith('xyz'))
  })

  it('pausar no borra: no pasa por el diálogo de confirmación', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente()]} />)
    await abrirMenu(user)
    await user.click(await screen.findByText('Pausar'))
    await waitFor(() => expect(pauseClient).toHaveBeenCalled())
    expect(screen.queryByText(/no se puede deshacer/i)).not.toBeInTheDocument()
  })
})

describe('ClientTable — borrar sigue estando, pero avisa', () => {
  it('el diálogo ofrece pausar como alternativa', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente()]} />)
    await abrirMenu(user)
    await user.click(await screen.findByText('Eliminar'))
    expect(await screen.findByText(/pausar/i)).toBeInTheDocument()
  })

  it('no borra nada hasta confirmar', async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[cliente()]} />)
    await abrirMenu(user)
    await user.click(await screen.findByText('Eliminar'))
    expect(deleteClient).not.toHaveBeenCalled()
  })
})
