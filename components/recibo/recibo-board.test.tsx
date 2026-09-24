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
vi.mock('@/lib/actions/recibo-captions', () => ({
  fillReciboCaption: vi.fn(async () => ({ ok: true, caption: 'Caption nuevo desde Metricool' })),
}))
vi.mock('@/lib/actions/idea-captions', () => ({
  saveIdeaCaption: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/entregas/enviar-al-cliente', () => ({
  EnviarAlCliente: () => <div data-testid="enviar" />,
  EnviarIdeaAlCliente: () => <button type="button">Enviar al cliente</button>,
}))

import userEvent from '@testing-library/user-event'
import { rangoSemana } from '@/lib/entregas/dias'
import { fillReciboCaption } from '@/lib/actions/recibo-captions'
import { saveIdeaCaption } from '@/lib/actions/idea-captions'
import { ReciboBoard } from './recibo-board'

/** Dated inside the current week so the week filter still includes the card. */
const publishThisWeek = rangoSemana().desde

const editedIdea = {
  id: 'i1',
  client_id: 'c1',
  title: 'Reel playa',
  status: 'producida',
  publish_date: publishThisWeek,
  generated_caption: 'El laboratorio ya abrió en Arecibo.',
  caption_draft: null,
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
      uploaded_at: `${publishThisWeek}T10:00:00Z`,
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
    expect(screen.queryByRole('button', { name: 'Ya se posteó' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No se posteó' })).not.toBeInTheDocument()
    expect(screen.queryByText('Publicación')).not.toBeInTheDocument()
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

  it('muestra el caption y lo guarda al editarlo', async () => {
    const user = userEvent.setup()
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea]}
      />,
    )
    const field = screen.getByLabelText('Caption')
    expect(field).toHaveValue('El laboratorio ya abrió en Arecibo.')
    await user.clear(field)
    await user.type(field, 'Texto corregido para todas las redes.')
    await user.click(screen.getByRole('button', { name: 'Guardar caption' }))
    await waitFor(() => {
      expect(saveIdeaCaption).toHaveBeenCalledWith('i1', 'Texto corregido para todas las redes.')
    })
  })

  it('pone captions solo en los videos que todavía no tienen', async () => {
    const user = userEvent.setup()
    const sinCaption = { ...editedIdea, id: 'i3', title: 'Sin texto', generated_caption: '', caption_draft: null }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea, sinCaption]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Poner captions' }))
    await waitFor(() => {
      expect(fillReciboCaption).toHaveBeenCalledTimes(1)
      expect(fillReciboCaption).toHaveBeenCalledWith('i3', expect.any(Array))
    })
    expect(await screen.findByDisplayValue('Caption nuevo desde Metricool')).toBeInTheDocument()
  })

  it('explica cómo activar AI si no hay clientes', () => {
    render(<ReciboBoard aiClients={[]} ideas={[]} />)
    expect(screen.getByText(/No hay videos por aprobar ni por programar/i)).toBeInTheDocument()
  })
})
