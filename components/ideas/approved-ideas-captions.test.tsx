import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'

vi.mock('@/lib/actions/idea-lab-captions', () => ({
  generateApprovedIdeaCaption: vi.fn(async () => ({ ok: true, caption: 'x' })),
  saveApprovedIdeaCaption: vi.fn(async () => ({ ok: true })),
  sendApprovedIdeaToMetricool: vi.fn(async () => ({ ok: true, scheduledFor: '2026-06-15T10:00:00' })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))

import { ApprovedIdeasCaptions } from './approved-ideas-captions'

const idea = (over: Partial<ApprovedIdea> = {}): ApprovedIdea => ({
  id: '1', client_id: 'c1', content_type: 'R', objective: null, funnel_stage: null,
  title: 'Reto de 30 días', hook: 'Empieza hoy', visual_brief: null,
  caption_angle: 'PAS con CTA', hashtags_suggestion: null, rationale: null, theme: null,
  created_at: '2026-06-07T00:00:00Z',
  generated_caption: null, caption_platform: null,
  metricool_post_id: null, metricool_scheduled_for: null,
  client: { id: 'c1', name: "Joe's Gym", metricool_blog_id: 'blog-1' },
  ...over,
})

afterEach(() => cleanup())

describe('ApprovedIdeasCaptions', () => {
  it('shows an empty state with no ideas', () => {
    render(<ApprovedIdeasCaptions ideas={[]} />)
    expect(screen.getByText(/Aún no hay ideas aprobadas/)).toBeInTheDocument()
  })

  it('renders the generate + send controls for an idea', () => {
    render(<ApprovedIdeasCaptions ideas={[idea()]} />)
    expect(screen.getByText('Reto de 30 días')).toBeInTheDocument()
    expect(screen.getByText('Generar con IA')).toBeInTheDocument()
    expect(screen.getByText('Enviar a Metricool')).toBeInTheDocument()
  })

  it('warns and cannot send when the client has no Metricool configured', () => {
    render(<ApprovedIdeasCaptions ideas={[idea({ client: { id: 'c1', name: 'X', metricool_blog_id: null } })]} />)
    expect(screen.getByText(/no tiene Metricool configurado/)).toBeInTheDocument()
  })

  it('shows the sent state instead of the form once already sent', () => {
    render(<ApprovedIdeasCaptions ideas={[idea({ metricool_post_id: 99, metricool_scheduled_for: '2026-06-15T10:00:00' })]} />)
    expect(screen.getByText(/Enviado a Metricool/)).toBeInTheDocument()
    expect(screen.queryByText('Enviar a Metricool')).toBeNull()
  })

  it('shows the cadence notice and defaults the schedule date to the cadence day', () => {
    render(
      <ApprovedIdeasCaptions
        ideas={[idea({ generated_caption: 'Listo' })]}
        nextPostByClient={{
          c1: {
            notice: '📅 El próximo Reel de Joe’s Gym se publicará el viernes en Instagram.',
            dateISO: '2099-12-31',
            typeLabels: ['Reel'],
            platformLabels: ['Instagram'],
          },
        }}
      />,
    )
    expect(screen.getByText(/se publicará el viernes en Instagram/)).toBeInTheDocument()
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput.value).toBe('2099-12-31')
  })

  it('disables send and warns when the chosen date is in the past', () => {
    render(<ApprovedIdeasCaptions ideas={[idea({ generated_caption: 'Listo para publicar' })]} />)
    const sendBtn = screen.getByRole('button', { name: /Enviar a Metricool/i })
    // Default date is tomorrow → sendable.
    expect(sendBtn).not.toBeDisabled()
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } })
    expect(sendBtn).toBeDisabled()
    expect(screen.getByText(/fecha ya pasó/i)).toBeInTheDocument()
  })
})
