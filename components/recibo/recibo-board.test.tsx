import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => true,
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/lib/actions/recibo', () => ({
  setManualPostedStatus: vi.fn(),
  setStaffClientApproval: vi.fn(),
  getReciboIdeaPreviewUrl: vi.fn(async () => ({ url: 'https://signed.example/play.mp4' })),
}))
vi.mock('@/components/entregas/enviar-al-cliente', () => ({
  EnviarAlCliente: () => <div data-testid="enviar" />,
  EnviarIdeaAlCliente: () => <button type="button">Enviar al cliente</button>,
}))

import { rangoSemana } from '@/lib/entregas/dias'
import { ReciboBoard } from './recibo-board'

// Default filter is «Solo esta semana». A fixed Saturday (2026-09-19) falls
// out of the Monday-start week on 2026-09-21 and CI hides the cards.
const { desde: estaSemana } = rangoSemana()

const editedIdea = {
  id: 'i1',
  client_id: 'c1',
  title: 'Reel playa',
  status: 'producida',
  publish_date: estaSemana,
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
      uploaded_at: `${estaSemana}T10:00:00Z`,
    } as any,
  ],
} as any

const bareIdea = {
  ...editedIdea,
  id: 'i2',
  title: 'Sin corte',
  videos: [],
} as any

describe('ReciboBoard', () => {
  it('muestra badge AI, toggles y player cuando hay URL', async () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea]}
      />,
    )
    expect(screen.getByTestId('recibo-board')).toBeInTheDocument()
    expect(screen.getByTestId('recibo-ai-badge')).toHaveTextContent('AI')
    expect(screen.getByRole('button', { name: 'Ya se posteó' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No se posteó' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobado por el cliente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No aprobado' })).toBeInTheDocument()
    expect(screen.queryByText('Subir video editado')).not.toBeInTheDocument()
    expect(screen.queryByTestId('submit-slot')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('recibo-video-player')).toHaveAttribute(
        'src',
        'https://signed.example/play.mp4',
      )
    })
  })

  it('muestra Sin video editado cuando no hay archivo', () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[bareIdea]}
      />,
    )
    expect(screen.getByTestId('recibo-video-empty')).toHaveTextContent('Sin video editado')
  })

  it('explica cómo activar AI si no hay clientes', () => {
    render(<ReciboBoard aiClients={[]} ideas={[]} />)
    expect(screen.getByText(/No hay clientes con modo de edición/i)).toBeInTheDocument()
  })
})
