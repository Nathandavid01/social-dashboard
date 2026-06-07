import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IdeaLab } from './idea-lab'

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const rateIdeaMock = vi.fn((_input?: unknown) => Promise.resolve({ ok: true }))
vi.mock('@/lib/actions/idea-feedback', () => ({
  rateIdea: (input: unknown) => rateIdeaMock(input),
}))

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  global.fetch = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(impl(url, init)) })
  ) as unknown as typeof fetch
}

describe('IdeaLab', () => {
  beforeEach(() => {
    mockFetch((url) => {
      if (url.startsWith('/api/trends')) {
        return { trends: [{ title: 'Bad Bunny', source: 'google' }], geo: 'PR' }
      }
      return { ideas: [] }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the content-type toggles and a generate button', async () => {
    render(<IdeaLab clients={[]} />)
    expect(screen.getByText('Reel')).toBeInTheDocument()
    expect(screen.getByText('Carrusel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generar 5 ideas/i })).toBeInTheDocument()
    expect(screen.getByText('Tus ideas aparecerán aquí.')).toBeInTheDocument()
  })

  it('loads live trends from /api/trends and shows them as chips', async () => {
    render(<IdeaLab clients={[]} />)
    expect(await screen.findByRole('button', { name: 'Bad Bunny' })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/trends')
  })

  it('lets the user add a manual trend', async () => {
    render(<IdeaLab clients={[]} />)
    const input = screen.getByPlaceholderText(/añade una tendencia/i)
    fireEvent.change(input, { target: { value: 'Promo verano' } })
    fireEvent.click(screen.getByRole('button', { name: /añadir tendencia/i }))
    expect(screen.getByRole('button', { name: /quitar promo verano/i })).toBeInTheDocument()
  })

  it('generates ideas and renders the result cards', async () => {
    mockFetch((url) => {
      if (url.startsWith('/api/trends')) return { trends: [] }
      return {
        ideas: [
          {
            content_type: 'R',
            objective: 'Engagement',
            funnel_stage: 'MOFU',
            title: 'Idea de prueba',
            hook: 'Un hook fuerte',
            visual_brief: 'Brief visual',
            caption_angle: 'Ángulo',
            hashtags_suggestion: '#nmedia',
            rationale: 'Funciona porque sí',
          },
        ],
      }
    })
    render(<IdeaLab clients={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 5 ideas/i }))
    expect(await screen.findByText('Idea de prueba')).toBeInTheDocument()
    expect(screen.getByText('Un hook fuerte')).toBeInTheDocument()
    // objective + funnel stage badge is surfaced
    expect(screen.getByText(/Engagement · MOFU/)).toBeInTheDocument()
  })

  it('approves an idea via the ✓ button, calling rateIdea and marking it approved', async () => {
    mockFetch((url) => {
      if (url.startsWith('/api/trends')) return { trends: [] }
      return {
        ideas: [
          {
            content_type: 'R',
            objective: 'Engagement',
            funnel_stage: 'MOFU',
            title: 'Idea aprobable',
            hook: 'Hook',
            visual_brief: 'VB',
            caption_angle: 'CA',
            hashtags_suggestion: '#x',
            rationale: 'R',
          },
        ],
      }
    })
    rateIdeaMock.mockClear()
    render(<IdeaLab clients={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /generar 5 ideas/i }))
    await screen.findByText('Idea aprobable')

    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))

    expect(rateIdeaMock).toHaveBeenCalledTimes(1)
    expect(rateIdeaMock.mock.calls[0][0]).toMatchObject({ verdict: 'approved', title: 'Idea aprobable' })
    expect(await screen.findByText(/Aprobada/)).toBeInTheDocument()
  })
})
