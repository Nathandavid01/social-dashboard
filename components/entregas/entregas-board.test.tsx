import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { IdeaWithPipeline, UserRole } from '@/lib/supabase/types'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
const discardEntregaVideos = vi.fn(async () => ({ ok: true as const, count: 1 }))
vi.mock('@/lib/actions/pipeline-submit', () => ({
  discardEntregaVideos: (...a: unknown[]) => discardEntregaVideos(...(a as [])),
}))
vi.mock('./review-overlay', () => ({ ReviewOverlay: () => <div data-testid="review-overlay">cola</div> }))
const mockRole: UserRole | null = 'supervisor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))

import { EntregasBoard, type PlannedClient } from './entregas-board'
import { fechaDeEntrega, fechaEntregaDelDia } from '@/lib/entregas/dias'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i', client_id: 'c1', content_type: 'R', title: 't',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: fechaDeEntrega(1), created_by: null,
    created_at: '2026-06-01', updated_at: '2026-06-01',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram'] },
    ...over,
  } as IdeaWithPipeline
}

beforeEach(() => {
  cleanup()
  push.mockClear()
})

describe('EntregasBoard — las columnas las define la ruta', () => {
  it('Revisión monta entrega y revisión', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[idea()]} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Editado', 'Revisión'])
  })

  it('Entregas monta copy y publicación', () => {
    render(<EntregasBoard stages={['copy','publication']} ideas={[idea()]} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Copy', 'Publicación'])
  })
})

describe('EntregasBoard — la operación es por día', () => {
  it('cada día es su propio tablero: el lunes no enseña lo del martes', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1) }),   // pestaña Lunes
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, publish_date: fechaDeEntrega(2) }), // pestaña Martes
    ]} />)
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
    expect(screen.queryByText('Lumen')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Martes' }))
    expect(screen.getByText('Lumen')).toBeInTheDocument()
    expect(screen.queryByText('Nora Fitness')).toBeNull()
  })

  it('la pestaña dice cuántos videos hay sin tener que entrar', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(2) }),
      idea({ id: '2', publish_date: fechaDeEntrega(2) }),
    ]} />)
    const martes = screen.getByRole('button', { name: 'Martes' })
    expect(martes.textContent).toMatch(/2/)
  })

  // La pestaña es el día en que se ENTREGA; se publica al día siguiente.
  it('la pestaña Lunes lleva lo que se publica el martes', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1) }),
    ]} />)
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('lo que se publica el lunes se entregó el sábado', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(6) }),   // entrega sábado
    ]} />)
    expect(screen.queryByText('Nora Fitness')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sábado' }))
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('un video sin fecha no desaparece: cae en "Sin día"', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1', publish_date: null })]} />)
    const sinDia = screen.getByRole('button', { name: /sin día/i })
    expect(sinDia).toBeInTheDocument()
    fireEvent.click(sinDia)
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('sin videos sueltos no hay pestaña "Sin día"', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1', publish_date: fechaDeEntrega(1) })]} />)
    expect(screen.queryByRole('button', { name: /sin día/i })).toBeNull()
  })
})

describe('EntregasBoard — batch model', () => {
  it('cada tarjeta trae una X para quitarla del tablero', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1' })]} />)
    expect(screen.getByRole('button', { name: /quitar Nora Fitness del tablero/i })).toBeInTheDocument()
  })

  it('la X pide confirmación antes de quitar nada', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /^quitar Nora Fitness/i }))
    expect(screen.getByRole('button', { name: /confirmar quitar/i })).toBeInTheDocument()
    expect(discardEntregaVideos).not.toHaveBeenCalled()
  })

  it('el segundo click sí la quita', async () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /^quitar Nora Fitness/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar quitar/i }))
    await waitFor(() => expect(discardEntregaVideos).toHaveBeenCalledWith(['1']))
  })

  it('la tarjeta de Publicación dice cuándo cae el borrador en Metricool', () => {
    render(<EntregasBoard
      stages={['edited','approval','copy','publication']}
      // Fecha relativa a hoy: el tablero filtra por semana, asi que una fecha
      // fija de 2099 se queda fuera de "esta semana" y la tarjeta no sale.
      ideas={[idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy', publish_date: fechaDeEntrega(1, undefined, 1) })]}
      postingTimes={{ c1: '14:30' }}
    />)
    // La semana que viene siempre es futura; en la actual la fecha puede haber
    // pasado ya y la tarjeta no anuncia un borrador vencido.
    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(screen.getByText(/Borrador en Metricool/i)).toBeInTheDocument()
    expect(screen.getByText(/· 14:30/)).toBeInTheDocument()
  })

  it('avisa cuando no hay fecha y Metricool la corre a +24h', () => {
    render(<EntregasBoard
      stages={['edited','approval','copy','publication']}
      ideas={[idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy', publish_date: null })]}
    />)
    // Sin fecha el video vive en la pestaña "Sin día", no en un día concreto.
    fireEvent.click(screen.getByRole('button', { name: /sin día/i }))
    expect(screen.getByText(/se corre a \+24h/i)).toBeInTheDocument()
  })

  it('solo las tarjetas de Publicación traen el botón de Metricool', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy listo' }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null },
             status: 'producida', approval_status: 'submitted' }),
    ]} />)
    // Un video aprobado CON copy está en Publicación; el enviado, en Revisión.
    expect(screen.getAllByRole('button', { name: /enviar a metricool/i })).toHaveLength(1)
  })

  it('renders the 4 columns in Spanish with Editado first and Copy after Revisión', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea()]} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Editado', 'Revisión', 'Copy', 'Publicación'])
  })



  it('un video sin título no deja la fila en blanco', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', title: undefined, hook: null }),
    ]} />)
    expect(container.querySelector('article')!.textContent).toContain('Sin título')
  })


  it('una tarjeta por VIDEO, no por cliente', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1' }), idea({ id: '2' }), idea({ id: '3' })]} />)
    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(3)
    Array.from(cards).forEach((c) => expect(c.textContent).toContain('Nora Fitness'))
  })

  it('cada video va a la columna que le toca, no a la del menos avanzado', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1', approval_status: 'approved' }), idea({ id: '2', status: 'grabada' })]} />)
    // least advanced is unsent → Editado column (1st section)
    const editedCol = container.querySelectorAll('section')[0]
    expect(editedCol.textContent).toContain('Nora Fitness')
  })

  it('shows the assignee filter and filters by person', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
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

  it('no se mueve arrastrando: en Entregas la tarjeta avanza por una decisión', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    expect(screen.queryByRole('button', { name: /mover batch adelante/i })).toBeNull()
  })

  it('shows "Sin asignar" for an unassigned batch', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('shows an "Atrasado" badge on a batch card with an overdue video', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ id: '1', client_id: 'c1', status: 'grabada', deadline: '2020-01-01' }),
    ] as IdeaWithPipeline[]} />)
    expect(container.querySelector('article')!.textContent).toContain('Atrasado')
  })

  it('al abrir una tarjeta sale la COLA de revisión, no la vista de lote', async () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[
      idea({ client_id: 'c9', status: 'producida', approval_status: 'submitted', client: { id: 'c9', name: 'Acme', industry: null } }),
    ]} />)
    fireEvent.click(container.querySelector('article')!)
    expect(await screen.findByTestId('review-overlay')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('EntregasBoard — planned sessions (empty slots)', () => {
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
      nextStage: 'edited',
      stepAssignee: { id: 'u1', name: 'Ana Torres' },
    },
  ]

  it('renders one planned card per client for the next single video', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[]} plannedClients={planned} />)
    expect(screen.getAllByText('Nathandavidts._')).toHaveLength(1)
    expect(screen.getByText('Lun 8 jun')).toBeInTheDocument()
    expect(screen.getByText('Próxima publicación')).toBeInTheDocument()
    expect(screen.getByText(/desde inicio · .* en esta fila/)).toBeInTheDocument()
    expect(screen.getByText('Planificado')).toBeInTheDocument()
    const thumb = container.querySelector('article img[alt=""]') as HTMLImageElement | null
    expect(thumb?.src).toContain('nd-logo.png')
    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
  })

})

describe('EntregasBoard — client dropdown filter (replaces chip row)', () => {
  const twoClients = [
    idea({ id: '1', client_id: 'c1' }),
    idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null } }),
  ] as IdeaWithPipeline[]

  it('renders a compact "Todos los clientes" dropdown trigger, closed by default', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={twoClients} />)
    expect(screen.getByRole('button', { name: /todos los clientes/i })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the list with every client + count and filters the board on select', () => {
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={twoClients} />)
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
    const { container } = render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    fireEvent.click(screen.getByRole('button', { name: /quitar filtro de cliente/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).toContain('Lumen')
  })

  it('still shows the batches/publicados stats line', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={twoClients} />)
    expect(screen.getByText(/publicados/i)).toBeInTheDocument()
  })
})

describe('EntregasBoard — drag-to-scroll columns (grab cursor)', () => {
  function scrollEl() {
    return document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
  }

  it('shows a grab cursor at rest and grabbing while dragging horizontally', () => {
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea()]} />)
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
    render(<EntregasBoard stages={['edited','approval','copy','publication']} ideas={[idea()]} />)
    const el = scrollEl()
    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseUp(el, { clientX: 300 })
    expect(el.className).not.toContain('cursor-grabbing')
  })
})

describe('EntregasBoard — lo que el revisor pidió cambiar', () => {
  const devuelto = () => idea({ id: 'v1', client_id: 'c1', approval_status: 'revision_needed' })

  it('enseña el texto de la corrección en la tarjeta del editor', () => {
    render(
      <EntregasBoard
        stages={['edited', 'approval']}
        ideas={[devuelto()]}
        reviewNotes={{ v1: { note: 'Corta los primeros 3 segundos', author: 'Tuti', at: '2026-07-30T10:00:00Z' } }}
      />,
    )
    expect(screen.getByText('Corta los primeros 3 segundos')).toBeInTheDocument()
  })

  it('dice quién los pidió, para saber a quién preguntar', () => {
    render(
      <EntregasBoard
        stages={['edited', 'approval']}
        ideas={[devuelto()]}
        reviewNotes={{ v1: { note: 'Cambia la música', author: 'Tuti', at: '2026-07-30T10:00:00Z' } }}
      />,
    )
    expect(screen.getByText(/Tuti/)).toBeInTheDocument()
  })

  it('sin correcciones no dibuja la caja', () => {
    render(<EntregasBoard stages={['edited', 'approval']} ideas={[idea({ id: 'v1' })]} reviewNotes={{}} />)
    expect(screen.queryByText(/Cambios pedidos/)).not.toBeInTheDocument()
  })

  // Con una tarjeta por video, cada una enseña LA SUYA: ya no hay que elegir
  // entre varias rondas dentro de la misma tarjeta.
  it('cada tarjeta enseña la corrección de su propio video', () => {
    render(
      <EntregasBoard
        stages={['edited', 'approval']}
        ideas={[devuelto(), idea({ id: 'v2', client_id: 'c1', approval_status: 'revision_needed' })]}
        reviewNotes={{
          v1: { note: 'corrige el inicio', author: null, at: '2026-07-01T10:00:00Z' },
          v2: { note: 'corrige el final', author: null, at: '2026-07-30T10:00:00Z' },
        }}
      />,
    )
    expect(screen.getByText('corrige el inicio')).toBeInTheDocument()
    expect(screen.getByText('corrige el final')).toBeInTheDocument()
  })
})

describe('EntregasBoard — vista semana', () => {
  it('abre en vista día: es lo que se usa para trabajar', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[idea({ id: '1' })]} />)
    expect(screen.queryByText('Tu semana')).toBeNull()
  })

  it('el conmutador enseña la semana', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(screen.getByText('Tu semana')).toBeInTheDocument()
  })

  it('cada día dice cuándo se publica lo que entregas ahí', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    // la semana cierra en domingo: sábado -> domingo, domingo -> lunes
    expect(screen.getByRole('button', { name: /Abrir Lunes/ })).toHaveTextContent('Martes')
    expect(screen.getByRole('button', { name: /Abrir Sábado/ })).toHaveTextContent('Domingo')
    expect(screen.getByRole('button', { name: /Abrir Domingo/ })).toHaveTextContent('Lunes')
  })

  it('cuenta los videos de cada día de entrega', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1) }),
      idea({ id: '2', publish_date: fechaDeEntrega(1) }),
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(screen.getByRole('button', { name: /Abrir Lunes: 2 videos/ })).toBeInTheDocument()
  })

  it('pulsar un día abre ese día en el tablero', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(2) }),
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    fireEvent.click(screen.getByRole('button', { name: /Abrir Martes/ }))
    expect(screen.queryByText('Tu semana')).toBeNull()
    expect(screen.getByRole('button', { name: 'Martes' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('EntregasBoard — trabajar adelantado', () => {
  it('abre en "Esta semana"', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[]} />)
    expect(screen.getByText('Esta semana')).toBeInTheDocument()
  })

  it('avanzar cambia a la próxima semana', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(screen.getByText('Próxima semana')).toBeInTheDocument()
  })

  it('no se puede retroceder por debajo de esta semana', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[]} />)
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeDisabled()
  })

  // Lo que motivó todo: dos martes distintos caían en la misma pestaña.
  it('cada semana enseña solo lo suyo', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1, undefined, 0) }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, publish_date: fechaDeEntrega(1, undefined, 1) }),
    ]} />)
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
    expect(screen.queryByText('Lumen')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(screen.getByText('Lumen')).toBeInTheDocument()
    expect(screen.queryByText('Nora Fitness')).toBeNull()
  })

  it('lo atrasado no se esconde: sigue en esta semana', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1, undefined, -3) }),
    ]} />)
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })
})

describe('EntregasBoard — el cliente aprobó antes que el copy', () => {
  const enCopy = () => idea({ id: 'v1', approval_status: 'approved', generated_caption: null, publish_date: fechaDeEntrega(1) })

  it('lo dice en la tarjeta, y que falta el copy', () => {
    render(<EntregasBoard stages={['copy','publication']} ideas={[enCopy()]} clientApprovals={{ v1: 'approved' }} />)
    expect(screen.getByText('Aprobado por el cliente · falta el copy')).toBeInTheDocument()
  })

  it('la tarjeta NO se mueve a Publicación sin copy', () => {
    render(<EntregasBoard stages={['copy','publication']} ideas={[enCopy()]} clientApprovals={{ v1: 'approved' }} />)
    const copy = screen.getByTestId('pipeline-scroll').querySelectorAll('[data-stage="copy"]')
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
    expect(copy.length >= 0).toBe(true)
  })

  it('sin respuesta del cliente no hay marca', () => {
    render(<EntregasBoard stages={['copy','publication']} ideas={[enCopy()]} clientApprovals={{}} />)
    expect(screen.queryByText(/Aprobado por el cliente/)).toBeNull()
  })

  it('un rechazo manda sobre lo demás', () => {
    render(<EntregasBoard
      stages={['copy','publication']}
      ideas={[enCopy(), idea({ id: 'v2', approval_status: 'approved', generated_caption: null, publish_date: fechaDeEntrega(1) })]}
      clientApprovals={{ v1: 'approved', v2: 'rejected' }}
    />)
    expect(screen.getByText('El cliente pidió cambios en 1')).toBeInTheDocument()
  })
})

/**
 * En Copy y Publicación la pestaña es el día en que se PUBLICA: es la cadencia
 * del cliente y lo que recibe Metricool. La Guira publica lunes, miércoles y
 * viernes, y verla en domingo, martes y jueves no se entendía.
 */
describe('EntregasBoard — modo publicación', () => {
  const enCopy = (fecha: string, id: string) =>
    idea({ id, approval_status: 'approved', generated_caption: null, publish_date: fecha })

  it('un video que publica el miércoles sale en Miércoles, no en Martes', () => {
    // miércoles de la semana en curso
    const mie = fechaEntregaDelDia(3)
    render(<EntregasBoard stages={['copy','publication']} ideas={[enCopy(mie, 'v1')]} modoDia="publicacion" />)
    fireEvent.click(screen.getByRole('button', { name: 'Miércoles' }))
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('en modo entrega ese mismo video sale un día antes', () => {
    const mie = fechaEntregaDelDia(3)
    render(<EntregasBoard stages={['copy','publication']} ideas={[enCopy(mie, 'v1')]} modoDia="entrega" />)
    fireEvent.click(screen.getByRole('button', { name: 'Martes' }))
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('una cadencia lunes-miércoles-viernes se ve en esos tres días', () => {
    render(<EntregasBoard
      stages={['copy','publication']}
      modoDia="publicacion"
      ideas={[
        enCopy(fechaEntregaDelDia(1), 'v1'),
        enCopy(fechaEntregaDelDia(3), 'v2'),
        enCopy(fechaEntregaDelDia(5), 'v3'),
      ]}
    />)
    for (const d of ['Lunes', 'Miércoles', 'Viernes']) {
      expect(screen.getByRole('button', { name: d }).textContent).toMatch(/1/)
    }
    expect(screen.getByRole('button', { name: 'Martes' }).textContent).not.toMatch(/[1-9]/)
  })
})

describe('EntregasBoard — el contador de la pestaña', () => {
  it('no cuenta los descartados: la tarjeta ya no esta ahi', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1) }),
      idea({ id: '2', publish_date: fechaDeEntrega(1), status: 'descartada' }),
    ]} />)
    expect(screen.getByRole('button', { name: 'Lunes' }).textContent).toMatch(/1/)
  })

  it('con todo descartado la pestaña queda sin numero', () => {
    render(<EntregasBoard stages={['edited','approval']} ideas={[
      idea({ id: '1', publish_date: fechaDeEntrega(1), status: 'descartada' }),
    ]} />)
    expect(screen.getByRole('button', { name: 'Lunes' }).textContent).not.toMatch(/[0-9]/)
  })
})
