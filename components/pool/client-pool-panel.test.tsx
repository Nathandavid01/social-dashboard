import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ClientPoolPanel } from '@/lib/utils/client-pool-state'

const schedulePoolIdea = vi.fn()
const toast = vi.fn()
vi.mock('@/lib/actions/client-pool', () => ({
  schedulePoolIdea: (...a: unknown[]) => schedulePoolIdea(...a),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/recording/video-cover', () => ({
  VideoCover: ({ title }: { title: string }) => <div data-testid="caratula">{title}</div>,
}))
vi.mock('@/components/clients/client-logo', () => ({
  ClientLogo: ({ name }: { name?: string | null }) => <span>{name}</span>,
}))
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ClientPoolPanelView } from './client-pool-panel'

const WEEK = { desde: '2026-09-21', hasta: '2026-09-27' }

function panel(over: Partial<ClientPoolPanel> = {}): ClientPoolPanel {
  return {
    week: WEEK,
    calendar: [
      {
        id: 'a1',
        clientId: 'ai',
        clientName: 'Arecibo Lab',
        title: 'Reel agendado',
        state: 'agendado',
        publishDate: '2026-09-23',
        coverVideoId: 'v1',
        coverUrl: null,
        scheduledFromHere: true,
        needsMetricoolReview: true,
      },
    ],
    clients: [
      {
        client: {
          id: 'ai',
          name: 'Arecibo Lab',
          posting_days: [3, 5],
          edit_mode: 'ai',
          metricool_blog_id: 'b',
        },
        weekDates: ['2026-09-23', '2026-09-25'],
        weekPosts: [
          {
            id: 'a1',
            clientId: 'ai',
            clientName: 'Arecibo Lab',
            title: 'Reel agendado',
            state: 'agendado',
            publishDate: '2026-09-23',
            coverVideoId: 'v1',
            coverUrl: null,
            scheduledFromHere: true,
            needsMetricoolReview: true,
          },
        ],
        pool: [
          {
            id: 'l1',
            clientId: 'ai',
            clientName: 'Arecibo Lab',
            title: 'Video listo',
            state: 'listo',
            publishDate: null,
            coverVideoId: 'v2',
            coverUrl: null,
            scheduledFromHere: false,
            needsMetricoolReview: false,
          },
        ],
        hidePool: false,
      },
      {
        client: {
          id: 'hum',
          name: 'Cliente hueco',
          posting_days: [1],
          edit_mode: 'human',
        },
        weekDates: ['2026-09-21'],
        weekPosts: [],
        pool: [],
        hidePool: true,
      },
    ],
    ...over,
  }
}

describe('ClientPoolPanelView', () => {
  beforeEach(() => {
    schedulePoolIdea.mockReset().mockResolvedValue({ ok: true, state: 'agendado' })
    toast.mockReset()
  })

  it('muestra clientes, pool Listo, carátula y Revisar en Metricool', () => {
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument()
    expect(screen.getAllByText('Arecibo Lab').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Video listo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Listo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Revisar en Metricool').length).toBeGreaterThan(0)
    expect(screen.queryByText('agendado desde aquí')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('caratula').length).toBeGreaterThan(0)
  })

  it('explica que Publicado lo confirma Metricool, no solo Ya se posteó', () => {
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    expect(screen.getByText(/Publicado se confirma con Metricool/i)).toBeInTheDocument()
    expect(screen.getByText(/no hace falta marcar Ya se posteó/i)).toBeInTheDocument()
  })

  it('esconde el pool vacío y no pinta Listo sin fecha en el calendario', () => {
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    expect(screen.queryByText('Pool de Cliente hueco')).not.toBeInTheDocument()
    const calendar = screen.getByTestId('pool-calendar')
    expect(calendar).toHaveTextContent('Reel agendado')
    expect(calendar).not.toHaveTextContent('Video listo')
  })

  it('al soltar un Listo en un día llama a schedulePoolIdea', async () => {
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    fireEvent.drop(screen.getByTestId('pool-day-2026-09-25'), {
      dataTransfer: { getData: () => 'l1' },
    })
    await waitFor(() => {
      expect(schedulePoolIdea).toHaveBeenCalledWith({ ideaId: 'l1', date: '2026-09-25' })
    })
  })

  it('en móvil: toca video, toca fecha y Agendar llama a schedulePoolIdea', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ClientPoolPanelView data={panel()} canSchedule />)

    const agendar = screen.getByRole('button', { name: 'Agendar' })
    expect(agendar).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Video listo/i }))
    expect(agendar).toBeDisabled()
    expect(schedulePoolIdea).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('pool-day-2026-09-25'))
    expect(agendar).toBeEnabled()
    expect(schedulePoolIdea).not.toHaveBeenCalled()

    await user.click(agendar)
    await waitFor(() => {
      expect(schedulePoolIdea).toHaveBeenCalledWith({ ideaId: 'l1', date: '2026-09-25' })
    })
  })

  it('Agendar no aparece si no puede agendar', () => {
    render(<ClientPoolPanelView data={panel()} canSchedule={false} />)
    expect(screen.queryByRole('button', { name: 'Agendar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pool-day-2026-09-25'))
    expect(schedulePoolIdea).not.toHaveBeenCalled()
  })

  it('al arrastrar un Agendado a otro día reprograma (no solo Listo)', async () => {
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    const card = screen.getByTestId('pool-agendado-a1')
    expect(card).toHaveAttribute('draggable', 'true')
    fireEvent.drop(screen.getByTestId('pool-day-2026-09-25'), {
      dataTransfer: { getData: () => 'a1' },
    })
    await waitFor(() => {
      expect(schedulePoolIdea).toHaveBeenCalledWith({ ideaId: 'a1', date: '2026-09-25' })
    })
  })

  it('si falta metricool_post_id muestra toast de error y no inventa éxito', async () => {
    schedulePoolIdea.mockResolvedValue({
      error: 'Este video no tiene un post en Metricool (falta metricool_post_id)',
    })
    render(<ClientPoolPanelView data={panel()} canSchedule />)
    fireEvent.drop(screen.getByTestId('pool-day-2026-09-25'), {
      dataTransfer: { getData: () => 'a1' },
    })
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        description: expect.stringMatching(/metricool_post_id/i),
      }))
    })
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/Agendado en Metricool/i),
    }))
  })
})
