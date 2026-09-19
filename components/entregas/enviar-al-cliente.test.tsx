import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const crearEnlaceCliente = vi.fn()
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/entregas-client-review', () => ({
  crearEnlaceCliente: (...a: unknown[]) => crearEnlaceCliente(...(a as [])),
}))

import { EnviarAlCliente } from './enviar-al-cliente'

const edited = {
  kind: 'edited' as const,
  storage_provider: 'entregas-r2' as const,
  status: 'uploaded' as const,
  drive_file_id: 'entregas/i1/edited/a.mp4',
}

const ideas = [
  {
    id: 'i1',
    client_id: 'c1',
    title: 'Reel uno',
    status: 'producida',
    videos: [edited],
    client: { id: 'c1', name: 'Acme' },
  },
  {
    id: 'i2',
    client_id: 'c1',
    title: 'Reel dos',
    status: 'producida',
    videos: [{ ...edited, drive_file_id: 'entregas/i2/edited/b.mp4' }],
    client: { id: 'c1', name: 'Acme' },
  },
] as never[]

beforeEach(() => {
  crearEnlaceCliente.mockReset()
  crearEnlaceCliente.mockResolvedValue({ token: 'tok-multi' })
})

describe('EnviarAlCliente', () => {
  it('generates one approval link with the selected ideaIds', async () => {
    render(<EnviarAlCliente ideas={ideas} />)
    fireEvent.click(screen.getByText('Enviar al cliente'))
    fireEvent.change(screen.getByLabelText('Cliente para enlace de aprobación'), { target: { value: 'c1' } })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    fireEvent.click(boxes[0])
    fireEvent.click(boxes[1])
    fireEvent.click(screen.getByRole('button', { name: /Generar enlace \(2\)/ }))
    await waitFor(() =>
      expect(crearEnlaceCliente).toHaveBeenCalledWith({
        clientId: 'c1',
        ideaIds: expect.arrayContaining(['i1', 'i2']),
      }),
    )
    const call = crearEnlaceCliente.mock.calls[0][0]
    expect(call.ideaIds).toHaveLength(2)
    expect(await screen.findByRole('button', { name: /Copiar enlace/i })).toBeInTheDocument()
  })

})
