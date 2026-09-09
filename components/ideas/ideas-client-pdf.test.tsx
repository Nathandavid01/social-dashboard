import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeasClientPdf } from './ideas-client-pdf'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'

const idea: ApprovedIdea = {
  id: '1',
  client_id: 'c1',
  content_type: 'R',
  objective: 'Conversion',
  funnel_stage: 'BOFU',
  title: 'Reto de 30 días',
  hook: 'Empieza hoy',
  visual_brief: 'Tomas dinámicas en el gym',
  caption_angle: 'PAS con CTA a DM',
  hashtags_suggestion: '#fitnesspr',
  rationale: 'interno — no debe salir en el PDF',
  theme: null,
  created_at: '2026-06-07T00:00:00Z',
  generated_caption: null,
  caption_platform: null,
  metricool_post_id: 999,
  metricool_scheduled_for: null,
  client: { id: 'c1', name: "Joe's Gym", metricool_blog_id: 'blog-1' },
}

describe('IdeasClientPdf', () => {
  it('renders nothing when there are no ideas', () => {
    const { container } = render(<IdeasClientPdf ideas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows client-facing fields and hides staff-only internals', () => {
    render(<IdeasClientPdf ideas={[idea]} />)
    expect(screen.getByText('Ideas de contenido')).toBeInTheDocument()
    expect(screen.getByText('Reto de 30 días')).toBeInTheDocument()
    expect(screen.getByText('Empieza hoy')).toBeInTheDocument()
    expect(screen.getByText('Brief visual')).toBeInTheDocument()
    expect(screen.getByText('Ángulo del caption')).toBeInTheDocument()
    expect(screen.getByText('#fitnesspr')).toBeInTheDocument()
    expect(screen.getByText('Reel')).toBeInTheDocument()
    expect(screen.getByText(/Conversion · BOFU/)).toBeInTheDocument()
    expect(screen.queryByText(/interno/)).not.toBeInTheDocument()
    expect(screen.queryByText('999')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar PDF/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Cliente/i)).toBeInTheDocument()
  })
})
