import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const moveBatch = vi.fn<(...a: unknown[]) => Promise<{ success?: boolean; error?: string }>>(async () => ({ success: true }))
vi.mock('@/lib/actions/content-ideas', () => ({ moveBatch: (...a: unknown[]) => moveBatch(...a) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
// Reactive fake so the overlay-in-URL flow (open pushes, back/Escape closes,
// reload reopens) can actually be exercised, not a no-op push spy.
vi.mock('next/navigation', async () => {
  const { createFakeNavigation } = await import('@/tests/fake-next-navigation')
  return createFakeNavigation('/pipeline')
})
import * as nav from 'next/navigation'
type FakeNav = {
  currentSearch: () => string
  reset: (s?: string) => void
  simulateBrowserBack: () => void
}
const { currentSearch, reset: resetNav, simulateBrowserBack } = nav as unknown as FakeNav
vi.mock('./new-video-dialog', () => ({ NewVideoDialog: () => <button>Nuevo video</button> }))
const getClientBatchData = vi.fn(async (..._a: unknown[]) => ({ pipeline: { client: { id: 'x', name: 'X' }, videos: [], assets: [] }, plannedSlots: [] }))
vi.mock('@/lib/actions/client-batch', () => ({ getClientBatchData: (...a: unknown[]) => getClientBatchData(...a) }))
const getBatchVideoPreviewUrls = vi.fn(async (ids: string[]) => ({
  urls: Object.fromEntries(ids.map((id) => [id, `https://cdn.example/preview/${id}.mp4`])),
}))
vi.mock('@/lib/actions/batch-video-previews', () => ({
  getBatchVideoPreviewUrls: (...a: unknown[]) => getBatchVideoPreviewUrls(...(a as [string[]])),
}))
vi.mock('@/components/clients/batch/client-batch-view', () => ({
  ClientBatchView: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="batch-overlay">
      overlay
      {onClose && <button onClick={onClose}>Cerrar</button>}
    </div>
  ),
}))

import { ContentPipelineBoard, type PlannedClient } from './content-pipeline-board'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i', client_id: 'c1', content_type: 'R', title: 't',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-06-01', updated_at: '2026-06-01',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram'] },
    ...over,
  } as IdeaWithPipeline
}

function editedVideo(id: string, uploadedAt = '2026-08-10T12:00:00Z') {
  return {
    id,
    idea_id: 'i',
    kind: 'edited' as const,
    name: `${id}.mp4`,
    drive_file_id: `entregas/x/edited/${id}.mp4`,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'entregas-r2' as const,
    mime_type: 'video/mp4',
    size_bytes: 1000,
    duration_sec: null,
    notes: null,
    uploaded_by: null,
    status: 'uploaded' as const,
    error_message: null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
  }
}

beforeEach(() => {
  cleanup()
  moveBatch.mockClear()
  moveBatch.mockResolvedValue({ success: true })
  resetNav('')
})

describe('ContentPipelineBoard — batch model', () => {
  it('renders the 4 columns in Spanish with Video first', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Video', 'Edición', 'Aprobación', 'Publicación'])
  })

  it('shows one batch card per client (not per video)', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' }), idea({ id: '3' })]} />)
    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Nora Fitness')
    expect(cards[0].textContent).toMatch(/3 videos en el batch/i)
  })

  it('places the batch in the column of its least-advanced video', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: '1', status: 'producida' }), idea({ id: '2', status: 'grabada' })]} />)
    // least advanced is grabada → Video column (1st section)
    const videoCol = container.querySelectorAll('section')[0]
    expect(videoCol.textContent).toContain('Nora Fitness')
  })

  it('shows the assignee filter and filters by person', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} teamMembers={[
      { id: 'u1', name: 'María R.' },
      { id: 'u2', name: 'Diego V.' },
      { id: 'u3', name: 'Nathan Torres' },
    ]} />)
    expect(screen.getByText(/asignado a/i)).toBeInTheDocument()
    const assigneeRow = screen.getByText(/asignado a/i).closest('div')!
    fireEvent.click(within(assigneeRow).getByRole('button', { name: /^Todos$/i }))
    fireEvent.click(screen.getByRole('option', { name: /María R\./i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).not.toContain('Lumen')
  })

  it('moves the whole batch forward, persisting all its videos', async () => {
    render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /mover batch adelante/i }))
    await waitFor(() => expect(moveBatch).toHaveBeenCalledWith(['1', '2'], 'edited'))
  })

  it('shows "Sin asignar" for an unassigned batch', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('shows the client logo on the batch card (header + strip)', () => {
    const { container } = render(
      <ContentPipelineBoard
        ideas={[
          idea({
            id: '1',
            client: {
              id: 'c1',
              name: 'Speedy Net',
              industry: null,
              logo_url: 'https://cdn.example/speedy-logo.png',
              platforms: ['instagram'],
            },
          }),
        ]}
      />,
    )
    const imgs = container.querySelectorAll('article img[src*="speedy-logo"]')
    // Header ClientLogo + at least one strip thumb using the logo.
    expect(imgs.length).toBeGreaterThanOrEqual(2)
    expect(imgs[0]).toHaveAttribute('alt', 'Speedy Net')
  })

  it('falls back to clientLogos map when idea.client.logo_url is empty (Metricool)', () => {
    const { container } = render(
      <ContentPipelineBoard
        ideas={[
          idea({
            id: '1',
            client_id: 'c1',
            client: { id: 'c1', name: 'Speedy Net', industry: null, logo_url: null, platforms: [] },
          }),
        ]}
        clientLogos={{ c1: 'https://cdn.example/metricool-speedy.png' }}
      />,
    )
    expect(container.querySelectorAll('article img[src*="metricool-speedy"]').length).toBeGreaterThanOrEqual(1)
  })

  it('shows editor-uploaded videos in the gray strip (not only logos)', async () => {
    getBatchVideoPreviewUrls.mockClear()
    const { container } = render(
      <ContentPipelineBoard
        ideas={[
          idea({
            id: '1',
            status: 'grabada',
            client: {
              id: 'c1',
              name: 'Speedy Net',
              industry: null,
              logo_url: 'https://cdn.example/speedy.png',
              platforms: [],
            },
            videos: [
              editedVideo('ev1', '2026-08-10T14:00:00Z'),
              editedVideo('ev2', '2026-08-10T13:00:00Z'),
            ],
          }),
        ]}
      />,
    )
    expect(container.querySelector('[data-testid="batch-video-strip"]')).toBeInTheDocument()
    await waitFor(() => {
      expect(getBatchVideoPreviewUrls).toHaveBeenCalled()
    })
    await waitFor(() => {
      const videos = container.querySelectorAll('article video')
      expect(videos.length).toBe(2)
      expect(videos[0]).toHaveAttribute('src', 'https://cdn.example/preview/ev1.mp4')
    })
  })

  it('shows an "Atrasado" badge on a batch card with an overdue video', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', status: 'grabada', deadline: '2020-01-01' }),
    ] as IdeaWithPipeline[]} />)
    expect(container.querySelector('article')!.textContent).toContain('Atrasado')
  })

  it('opens the client batch overlay in place on card click (same page — the URL gains ?lote=, no route change)', async () => {
    getClientBatchData.mockClear()
    const { container } = render(<ContentPipelineBoard ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]} />)
    fireEvent.click(container.querySelector('article')!)
    expect(getClientBatchData).toHaveBeenCalledWith('c9', undefined)
    expect(currentSearch()).toBe('lote=c9')
    expect(await screen.findByTestId('batch-overlay')).toBeInTheDocument()
  })
})

describe('ContentPipelineBoard — flujo natural: el overlay vive en la URL', () => {
  function openBoard() {
    return render(
      <ContentPipelineBoard
        ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]}
      />,
    )
  }

  it('cerrar con el botón X quita los params y no deja el overlay', async () => {
    getClientBatchData.mockClear()
    const { container } = openBoard()
    fireEvent.click(container.querySelector('article')!)
    await screen.findByTestId('batch-overlay')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(currentSearch()).toBe('')
    expect(screen.queryByTestId('batch-overlay')).not.toBeInTheDocument()
  })

  it('el back del navegador cierra el overlay y deja el tablero — no desmonta la pantalla', async () => {
    getClientBatchData.mockClear()
    const { container } = openBoard()
    fireEvent.click(container.querySelector('article')!)
    await screen.findByTestId('batch-overlay')

    act(() => simulateBrowserBack())
    // El tablero sigue ahí (los headers de columna siguen presentes) y el
    // overlay se fue — nada de "saliste de la pantalla".
    expect(screen.queryByTestId('batch-overlay')).not.toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
    expect(screen.getByText('Publicación')).toBeInTheDocument()
  })

  it('Escape cierra el overlay y retrocede el historial (no deja una entrada huérfana)', async () => {
    getClientBatchData.mockClear()
    const { container } = openBoard()
    fireEvent.click(container.querySelector('article')!)
    await screen.findByTestId('batch-overlay')
    expect(currentSearch()).toBe('lote=c9')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(currentSearch()).toBe('')
    expect(screen.queryByTestId('batch-overlay')).not.toBeInTheDocument()

    // A second Escape (or a stray keydown after close) must not pop past an
    // already-closed overlay.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(currentSearch()).toBe('')
  })

  it('recargar con ?lote= en la URL reabre el mismo cliente (deep link)', async () => {
    getClientBatchData.mockClear()
    resetNav('lote=c9')
    render(<ContentPipelineBoard ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]} />)
    expect(await screen.findByTestId('batch-overlay')).toBeInTheDocument()
    expect(getClientBatchData).toHaveBeenCalledWith('c9', undefined)
  })

  it('cerrar tras un deep link no navega hacia atrás fuera del tablero (replace, no back)', async () => {
    getClientBatchData.mockClear()
    resetNav('lote=c9')
    render(<ContentPipelineBoard ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]} />)
    await screen.findByTestId('batch-overlay')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(currentSearch()).toBe('')
    expect(screen.queryByTestId('batch-overlay')).not.toBeInTheDocument()
  })
})

describe('ContentPipelineBoard — planned sessions (empty slots)', () => {
  const planned: PlannedClient[] = [
    {
      clientId: 'nd',
      clientName: 'Nathandavidts._',
      logoUrl: 'https://cdn.example/nd-logo.png',
      createdAt: '2026-05-15',
      inColumnSince: '2026-06-14',
      platforms: ['instagram'],
      sessions: [
        { index: 0, label: 'Lun 8 jun', total: 1, filled: 0, empty: 1, publishDate: '2026-06-08' },
      ],
      nextStage: 'video',
      stepAssignee: { id: 'u1', name: 'Ana Torres' },
    },
  ]

  it('renders one planned card per client for the next single video', () => {
    const { container } = render(<ContentPipelineBoard ideas={[]} plannedClients={planned} />)
    expect(screen.getAllByText('Nathandavidts._')).toHaveLength(1)
    expect(screen.getByText('Lun 8 jun')).toBeInTheDocument()
    expect(screen.getByText('Próxima publicación')).toBeInTheDocument()
    expect(screen.getByText(/desde inicio · .* en esta fila/)).toBeInTheDocument()
    expect(screen.getByText('Planificado')).toBeInTheDocument()
    const thumb = container.querySelector('article img[alt=""]') as HTMLImageElement | null
    expect(thumb?.src).toContain('nd-logo.png')
    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
  })

  it('opens the client batch overlay when a planned card is clicked', async () => {
    getClientBatchData.mockClear()
    const { container } = render(<ContentPipelineBoard ideas={[]} plannedClients={planned} />)
    fireEvent.click(container.querySelector('article')!)
    await waitFor(() =>
      expect(getClientBatchData).toHaveBeenCalledWith('nd', {
        fromPlanned: true,
        publishDate: '2026-06-08',
        publishLabel: 'Lun 8 jun',
      }),
    )
  })
})

describe('ContentPipelineBoard — client dropdown filter (replaces chip row)', () => {
  const twoClients = [
    idea({ id: '1', client_id: 'c1' }),
    idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null } }),
  ] as IdeaWithPipeline[]

  it('renders a compact "Todos los clientes" dropdown trigger, closed by default', () => {
    render(<ContentPipelineBoard ideas={twoClients} />)
    expect(screen.getByRole('button', { name: /todos los clientes/i })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the list with every client + count and filters the board on select', () => {
    const { container } = render(<ContentPipelineBoard ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /lumen/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Lumen')
    expect(cardsText).not.toContain('Nora Fitness')
    // trigger now reflects the selection and the list is closed
    expect(screen.getByRole('button', { name: 'Lumen' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('clears the filter back to all clients via the clear button', () => {
    const { container } = render(<ContentPipelineBoard ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    fireEvent.click(screen.getByRole('button', { name: /quitar filtro de cliente/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).toContain('Lumen')
  })

  it('still shows the batches/publicados stats line', () => {
    render(<ContentPipelineBoard ideas={twoClients} />)
    expect(screen.getByText(/publicados/i)).toBeInTheDocument()
  })
})

describe('ContentPipelineBoard — drag-to-scroll columns (grab cursor)', () => {
  function scrollEl() {
    return document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
  }

  it('shows a grab cursor at rest and grabbing while dragging horizontally', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const el = scrollEl()
    expect(el.className).toContain('cursor-grab')
    expect(el.className).not.toContain('cursor-grabbing')

    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseMove(el, { clientX: 260 }) // moved 40px ≥ threshold
    expect(el.className).toContain('cursor-grabbing')

    fireEvent.mouseUp(el)
    expect(el.className).not.toContain('cursor-grabbing')
  })

  it('does not enter grabbing state for a click without movement (cards stay clickable)', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const el = scrollEl()
    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseUp(el, { clientX: 300 })
    expect(el.className).not.toContain('cursor-grabbing')
  })
})
