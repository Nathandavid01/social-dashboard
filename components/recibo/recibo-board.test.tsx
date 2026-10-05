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
  getReciboIdeaDownloadUrl: vi.fn(async () => ({ url: 'https://signed.example/download.mp4' })),
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
vi.mock('@/lib/actions/recibo-publish', () => ({
  publishReciboOnCadence: vi.fn(async () => ({ ok: true, label: 'viernes 25 de septiembre, 6:00 p.m.' })),
  cancelReciboSchedule: vi.fn(async () => ({ ok: true, deleted: true })),
}))
vi.mock('@/lib/actions/review-staff', () => ({
  addStaffReviewComment: vi.fn(async () => ({ ok: true })),
  getReciboReviewComments: vi.fn(async () => []),
}))
vi.mock('@/lib/actions/recibo-internal-notes', () => ({
  addReciboInternalNote: vi.fn(async () => ({ ok: true })),
  listReciboInternalNotes: vi.fn(async () => []),
}))
vi.mock('@/lib/actions/entregas-client-review', () => ({
  crearEnlaceCliente: vi.fn(async () => ({ token: 'abc' })),
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
import { getReciboIdeaDownloadUrl, getReciboIdeaPreviewUrl } from '@/lib/actions/recibo'
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
    expect(screen.getByRole('button', { name: 'Enviado' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Aprobado' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Márcalo aprobado para programarlo/i)).toBeInTheDocument()
    expect(screen.queryByText('Subir video editado')).not.toBeInTheDocument()
    expect(screen.queryByTestId('submit-slot')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('recibo-video-player')).toHaveAttribute(
        'src',
        'https://signed.example/play.mp4',
      )
    })
  })

  it('un idea sin archivo no ocupa espacio; con cadencia se ve el hueco pendiente', () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[bareIdea]}
        todayISO={publishThisWeek}
        cadenceByClient={{ c1: { postingDays: [1, 3, 5] } }}
      />,
    )
    expect(screen.queryByTestId('recibo-idea-i2')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('recibo-space-empty').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
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
    expect(screen.getByTestId('recibo-upload-counts')).toHaveTextContent('Publicados 0')
    expect(screen.getByTestId('recibo-client-counts-c1')).toHaveTextContent('Total 3 · Nathan 1 · Eric 1 · Sin autor 1 · Publicados 0')
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

  it('cada tarjeta con corte tiene «Bajar» y baja ese mismo archivo', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ReciboBoard aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]} ideas={[editedIdea]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Reel playa' }))
    await waitFor(() => expect(getReciboIdeaDownloadUrl).toHaveBeenCalledWith('i1', 'v1'))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    click.mockRestore()
  })

  it('la entrega puntual (cliente humano) también se puede bajar', () => {
    render(<ReciboBoard aiClients={[]} ideas={[editedIdea]} />)
    expect(screen.getByRole('button', { name: 'Bajar Reel playa' })).toBeInTheDocument()
  })

  it('sin corte editado no hay nada que bajar', () => {
    render(<ReciboBoard aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]} ideas={[bareIdea]} />)
    expect(screen.queryByRole('button', { name: /^Bajar/ })).not.toBeInTheDocument()
  })
  it('cada tarjeta trae la marca Publicado junto a Enviado y Aprobado', () => {
    render(<ReciboBoard aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]} ideas={[editedIdea]} />)
    expect(screen.getByRole('button', { name: 'Publicado' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('ReciboBoard — espacios de cadencia y conteo mensual', () => {
  it('llena espacios con videos y deja huecos pendientes según la cadencia', () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea]}
        todayISO={publishThisWeek}
        cadenceByClient={{ c1: { postingDays: [1, 3, 5] } }}
      />,
    )
    expect(screen.getByTestId('recibo-idea-i1')).toHaveAttribute('data-tone', 'pending')
    expect(screen.getAllByTestId('recibo-space-empty').length).toBeGreaterThan(0)
    expect(screen.getByTestId('recibo-client-counts-c1')).toHaveTextContent(/espacios esta semana/i)
  })

  it('marca en verde un espacio aprobado y en ámbar uno pendiente', () => {
    const approved = {
      ...editedIdea,
      id: 'ok',
      staff_client_approval: 'approved',
      videos: [{ ...editedIdea.videos[0], id: 'v-ok' }],
    }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea, approved]}
        todayISO={publishThisWeek}
        cadenceByClient={{ c1: { postingDays: [1, 3] } }}
      />,
    )
    expect(screen.getByTestId('recibo-idea-i1')).toHaveAttribute('data-tone', 'pending')
    expect(screen.getByTestId('recibo-idea-ok')).toHaveAttribute('data-tone', 'approved')
  })

  it('cuenta por mes las mismas subidas que llenan los espacios, con el mes actual destacado', () => {
    const older = {
      ...editedIdea,
      id: 'old',
      videos: [{ ...editedIdea.videos[0], id: 'v-old', uploaded_at: '2026-09-04T10:00:00Z' }],
    }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[editedIdea, older]}
        occupancyIdeas={[editedIdea, older]}
        todayISO="2026-10-04"
      />,
    )
    const monthly = screen.getByTestId('recibo-monthly-counts')
    expect(monthly.textContent).toMatch(/octubre/i)
    expect(monthly.textContent).toMatch(/septiembre/i)
    expect(monthly.textContent).toMatch(/Total 2/)
    expect(monthly.querySelector('[data-current="true"]')?.textContent).toMatch(/octubre/i)
    expect(screen.getByTestId('recibo-client-months-c1').textContent).toMatch(/Total 2/)
  })

  it('un crudo de cliente AI ocupa espacio sin aprobar ni borrar', () => {
    const raw = {
      ...editedIdea,
      id: 'raw1',
      generated_caption: '',
      videos: [{ ...editedIdea.videos[0], id: 'rawv', kind: 'raw', drive_thumb_url: 'https://img.example/raw.jpg' }],
    }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[]}
        occupancyIdeas={[raw]}
        todayISO={publishThisWeek}
        cadenceByClient={{ c1: { postingDays: [1, 3] } }}
      />,
    )
    expect(screen.getByTestId('recibo-idea-raw1')).toHaveAttribute('data-tone', 'pending')
    expect(screen.getByRole('img', { name: /portada/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar en metricool/i })).not.toBeInTheDocument()
  })

  it('un cliente held no gana columna vacía aunque esté en la lista AI', () => {
    render(
      <ReciboBoard
        aiClients={[
          { id: '165b8416-5316-43e1-b6d6-f23caaa57b0c', name: 'Aníbal Fuentes PNP', logo_url: null },
          { id: 'c1', name: 'Arecibo Lab', logo_url: null },
        ]}
        ideas={[]}
        todayISO="2026-10-04"
        cadenceByClient={{
          '165b8416-5316-43e1-b6d6-f23caaa57b0c': { postingDays: [1, 3, 5] },
          c1: { postingDays: [1] },
        }}
      />,
    )
    expect(screen.queryByText('Aníbal Fuentes PNP')).not.toBeInTheDocument()
    expect(screen.getByText('Arecibo Lab')).toBeInTheDocument()
  })

  it('un corte de Eric en cliente humano no abre huecos de cadencia', () => {
    const farmacia = {
      ...editedIdea,
      id: 'farm',
      client_id: 'farmacia',
      client: { id: 'farmacia', name: 'Farmacia Buena Vida', industry: null, logo_url: null },
    }
    render(
      <ReciboBoard
        aiClients={[]}
        ideas={[farmacia]}
        todayISO={publishThisWeek}
        cadenceByClient={{ farmacia: { postingDays: [1, 3, 5] } }}
      />,
    )
    expect(screen.getByTestId('recibo-idea-farm')).toBeInTheDocument()
    expect(screen.queryByTestId('recibo-space-empty')).not.toBeInTheDocument()
  })

  it('un voto de /aprobacion pinta el espacio en verde', () => {
    const voted = { ...editedIdea, id: 'voted', entregas_review_status: 'approved', videos: [{ ...editedIdea.videos[0], id: 'vv' }] }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[voted]}
        todayISO={publishThisWeek}
      />,
    )
    expect(screen.getByTestId('recibo-idea-voted')).toHaveAttribute('data-tone', 'approved')
  })

  it('un espacio ya programado se ve con Cambiar fecha y Cancelar', () => {
    const scheduled = {
      ...editedIdea,
      id: 'sch1',
      metricool_post_id: 44,
      posted_at: `${publishThisWeek}T12:00:00Z`,
      publish_date: publishThisWeek,
      staff_client_approval: 'approved',
      videos: [{ ...editedIdea.videos[0], id: 'vs1' }],
    }
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[]}
        occupancyIdeas={[scheduled]}
        todayISO={publishThisWeek}
        cadenceByClient={{ c1: { postingDays: [1, 3, 5], postingTime: '18:00', metricool: true } }}
      />,
    )
    expect(screen.getByTestId('recibo-idea-sch1')).toHaveAttribute('data-tone', 'scheduled')
    expect(screen.getByRole('button', { name: /Cambiar fecha/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar programación/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicado' })).not.toBeInTheDocument()
  })

  it('muestra clientes AI sin video para que se vean los espacios pendientes', () => {
    render(
      <ReciboBoard
        aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]}
        ideas={[]}
        todayISO="2026-10-04"
        cadenceByClient={{ c1: { postingDays: [1, 4] } }}
      />,
    )
    expect(screen.getByText('Arecibo Lab')).toBeInTheDocument()
    expect(screen.getAllByTestId('recibo-space-empty')).toHaveLength(2)
  })
})

describe('ReciboBoard — buscar y motivo', () => {
  it('filtra tarjetas por cliente o título sin recargar', async () => {
    const user = userEvent.setup()
    const farmacia = {
      ...editedIdea,
      id: 'farm',
      client_id: 'farmacia',
      title: 'Pregunta para todas',
      generated_caption: 'Pregunta en el mostrador.',
      client: { id: 'farmacia', name: 'Farmacia Buena Vida', industry: null, logo_url: null },
    }
    render(
      <ReciboBoard
        aiClients={[
          { id: 'c1', name: 'Arecibo Lab', logo_url: null },
          { id: 'farmacia', name: 'Farmacia Buena Vida', logo_url: null },
        ]}
        ideas={[editedIdea, farmacia]}
      />,
    )
    expect(screen.getByTestId('recibo-idea-i1')).toBeInTheDocument()
    expect(screen.getByTestId('recibo-idea-farm')).toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: /buscar cliente o idea/i })
    expect(search).toHaveAttribute('placeholder', 'Buscar cliente o idea…')
    await user.type(search, 'farmacia')
    expect(screen.queryByTestId('recibo-idea-i1')).not.toBeInTheDocument()
    expect(screen.getByTestId('recibo-idea-farm')).toBeInTheDocument()
    await user.clear(search)
    expect(screen.getByTestId('recibo-idea-i1')).toBeInTheDocument()
    expect(screen.getByTestId('recibo-idea-farm')).toBeInTheDocument()
  })

  it('cada tarjeta ocupada tiene el cuadro para decir por qué no les gusta', async () => {
    render(<ReciboBoard aiClients={[{ id: 'c1', name: 'Arecibo Lab', logo_url: null }]} ideas={[editedIdea]} />)
    expect(await screen.findByRole('textbox', { name: /por qué no te gusta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar motivo/i })).toBeInTheDocument()
  })
})

it('separates a client graphic from videos and renders its image with caption', async () => {
  vi.mocked(getReciboIdeaPreviewUrl).mockResolvedValue({ url: 'https://signed.example/graphic.png' })
  const graphic = { ...editedIdea, id: 'graphic-1', title: 'Encías', content_type: 'P', generated_caption: 'Cuida tus encías.', videos: [{ ...editedIdea.videos[0], id: 'g1', mime_type: 'image/png' }] }
  render(<ReciboBoard ideas={[editedIdea, graphic] as any} aiClients={[{ id: 'c1', name: 'Arecibo Lab' }]} />)
  expect(screen.getByRole('region', { name: 'Arecibo Lab · Gráficos' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Arecibo Lab · Videos' })).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('img', { name: 'Encías' })).toBeTruthy())
  const card = screen.getByTestId('recibo-idea-graphic-1')
  expect(card.querySelector('video')).toBeNull()
  expect(card.textContent).not.toContain('Programar en Metricool')
  expect(card.textContent).not.toContain('Programar para')
})
