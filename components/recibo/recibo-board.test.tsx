import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => true,
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/lib/actions/recibo', () => ({
  setManualPostedStatus: vi.fn(),
  setStaffClientApproval: vi.fn(),
}))
vi.mock('@/components/pipeline/editor-submit-slot', () => ({
  EditorSubmitSlot: () => <div data-testid="submit-slot" />,
}))
vi.mock('@/components/entregas/enviar-al-cliente', () => ({
  EnviarAlCliente: () => <div data-testid="enviar" />,
}))
vi.mock('@/lib/entregas/enviar-al-cliente', () => ({
  ideaTieneEditadoEntregas: () => true,
}))

import { ReciboBoard } from './recibo-board'

describe('ReciboBoard', () => {
  it('muestra badge AI y toggles en español', () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[
          {
            id: 'i1',
            client_id: 'c1',
            title: 'Reel playa',
            status: 'producida',
            publish_date: '2026-09-19',
            manual_posted_status: null,
            staff_client_approval: null,
            client: { id: 'c1', name: 'Arecibo Lab', industry: null, logo_url: null },
            videos: [
              {
                id: 'v1',
                idea_id: 'i1',
                kind: 'edited',
                storage_provider: 'entregas-r2',
                status: 'uploaded',
                drive_file_id: 'key',
              } as any,
            ],
          } as any,
        ]}
      />,
    )
    expect(screen.getByTestId('recibo-board')).toBeInTheDocument()
    expect(screen.getByTestId('recibo-ai-badge')).toHaveTextContent('AI')
    expect(screen.getByRole('button', { name: 'Ya se posteó' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No se posteó' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobado por el cliente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No aprobado' })).toBeInTheDocument()
  })

  it('explica cómo activar AI si no hay clientes', () => {
    render(<ReciboBoard aiClients={[]} ideas={[]} />)
    expect(screen.getByText(/No hay clientes con modo de edición/i)).toBeInTheDocument()
  })
})
