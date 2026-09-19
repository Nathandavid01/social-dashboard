import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const crearEnlaceCliente = vi.fn()
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/entregas-client-review', () => ({
  crearEnlaceCliente: (...a: unknown[]) => crearEnlaceCliente(...(a as [])),
}))

import { EnviarAlCliente, EnviarIdeaAlCliente } from './enviar-al-cliente'

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
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('EnviarAlCliente', () => {
  it('auto-selects the only client and all videos, then one-tap copies the link', async () => {
    render(<EnviarAlCliente ideas={ideas} />)
    expect(screen.getByTestId('enviar-cliente-unico')).toHaveTextContent('Acme')
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    })
    // all selected by default
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Copiar enlace para el cliente \(2\)/ }))
    await waitFor(() =>
      expect(crearEnlaceCliente).toHaveBeenCalledWith({
        clientId: 'c1',
        ideaIds: expect.arrayContaining(['i1', 'i2']),
      }),
    )
    expect(await screen.findByTestId('enlace-aprobacion-result')).toBeInTheDocument()
    expect((screen.getByLabelText('Enlace de aprobación generado') as HTMLInputElement).value).toMatch(
      /\/aprobacion\/tok-multi$/,
    )
  })
})

describe('EnviarIdeaAlCliente', () => {
  it('generates a single-idea link in one click', async () => {
    crearEnlaceCliente.mockResolvedValue({ token: 'tok-one' })
    render(<EnviarIdeaAlCliente idea={ideas[0] as never} />)
    fireEvent.click(screen.getByTestId('enviar-idea-i1'))
    await waitFor(() =>
      expect(crearEnlaceCliente).toHaveBeenCalledWith({ clientId: 'c1', ideaIds: ['i1'] }),
    )
  })
})
