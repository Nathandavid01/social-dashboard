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
vi.mock('@/lib/actions/pipeline-submit', () => ({
  discardEntregaVideos: vi.fn(async () => ({ ok: true, count: 1 })),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/components/entregas/enviar-al-cliente', () => ({
  EnviarAlCliente: () => <div data-testid="enviar" />,
  EnviarIdeaAlCliente: () => <button type="button">Enviar al cliente</button>,
}))

import userEvent from '@testing-library/user-event'
import { rangoSemana } from '@/lib/entregas/dias'
import { fillReciboCaption } from '@/lib/actions/recibo-captions'
import { saveIdeaCaption } from '@/lib/actions/idea-captions'
import { discardEntregaVideos } from '@/lib/actions/pipeline-submit'
import { getReciboIdeaPreviewUrl } from '@/lib/actions/recibo'
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
  it('limita la entrega puntual al archivo mostrado y evita acciones de toda la idea', async () => {
    render(<ReciboBoard aiClients={[]} ideas={[editedIdea]} />)
    await waitFor(() => expect(getReciboIdeaPreviewUrl).toHaveBeenCalledWith('i1', 'v1'))
    expect(screen.queryByTestId('enviar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument()
  })
  it('identifica una entrega puntual sin etiquetar al cliente humano como AI', () => {
    render(<ReciboBoard aiClients={[]} ideas={[editedIdea]} />)
    expect(screen.getByText('Entrega puntual')).toBeInTheDocument()
    expect(screen.queryByTestId('recibo-ai-badge')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Caption')).toHaveValue(editedIdea.generated_caption)
  })

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
    expect(screen.queryByRole('button', { name: 'Aprobado por el cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No aprobado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar al cliente' })).not.toBeInTheDocument()
    expect(screen.queryByText('Reel playa')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Caption')).toHaveValue('El laboratorio ya abrió en Arecibo.')
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
    field.blur()
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

  it('cuenta los cortes de Nathan y de Eric, y marca cada tarjeta', async () => {
    const nathan = {
      ...editedIdea,
      id: 'n1',
      title: 'De Nathan',
      videos: [{ ...editedIdea.videos[0], id: 'vn', uploader: { full_name: 'Nathan Torres' } }],
    }
    const eric = {
      ...editedIdea,
      id: 'e1',
      title: 'De Eric',
      videos: [{ ...editedIdea.videos[0], id: 've', uploader: { full_name: 'Eric Perez' } }],
    }
    const yabu = {
      ...editedIdea,
      id: 'y1',
      client_id: 'c2',
      title: 'De Yabuuchi',
      client: { id: 'c2', name: 'YabushiSushi', industry: null, logo_url: null },
      videos: [{ ...editedIdea.videos[0], id: 'vy', uploader: { full_name: 'Eric Perez' } }],
    }
    render(
      <ReciboBoard
        showUploadCounts
        aiClients={[
          { id: 'c1', name: 'Arecibo Lab', logo_url: null },
          { id: 'c2', name: 'YabushiSushi', logo_url: null },
        ]}
        ideas={[nathan, eric, editedIdea, yabu]}
      />,
    )
    await screen.findAllByTestId('recibo-video-player')
    expect(screen.getByTestId('recibo-upload-counts')).toHaveTextContent('Total 4 · Nathan 1 · Eric 2 · Sin autor 1')
    expect(screen.getByTestId('recibo-client-counts-c1')).toHaveTextContent('Total 3 · Nathan 1 · Eric 1 · Sin autor 1')
    expect(screen.getByTestId('recibo-client-counts-c2')).toHaveTextContent('Total 1 · Nathan 0 · Eric 1 · Sin autor 0')
    expect(screen.queryByTestId('recibo-uploader-n1')).not.toBeInTheDocument()
  })

  it('esconde el conteo si quien mira no está en la lista', async () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea]}
      />,
    )
    await screen.findByTestId('recibo-video-player')
    expect(screen.queryByTestId('recibo-upload-counts')).not.toBeInTheDocument()
    expect(screen.getByTestId('recibo-client-counts-c1')).toHaveTextContent('1 video')
    expect(screen.queryByTestId('recibo-uploader-i1')).not.toBeInTheDocument()
  })

  it('pide confirmación antes de borrar el video', async () => {
    const user = userEvent.setup()
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Borrar Reel playa' }))
    expect(discardEntregaVideos).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => {
      expect(discardEntregaVideos).toHaveBeenCalledWith(['i1'])
    })
  })

  it('explica cómo activar AI si no hay clientes', () => {
    render(<ReciboBoard aiClients={[]} ideas={[]} />)
    expect(screen.getByText(/No hay videos por aprobar ni por programar/i)).toBeInTheDocument()
  })
})

describe('ReciboBoard — corte de Eric en un cliente con editor (v5.113)', () => {
  it('no marca «AI» al cliente humano; sigue marcando al AI', () => {
    const farmacia = {
      ...editedIdea,
      id: 'farm',
      client_id: 'farmacia',
      title: 'Pregunta para todas',
      client: { id: 'farmacia', name: 'Farmacia Buena Vida', industry: null, logo_url: null },
    }
    render(<ReciboBoard ideas={[editedIdea, farmacia]} aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]} />)
    expect(screen.getAllByTestId('recibo-ai-badge')).toHaveLength(1)
    expect(screen.getByText('Farmacia Buena Vida')).toBeInTheDocument()
  })
})
