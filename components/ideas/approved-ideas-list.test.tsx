import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApprovedIdeasList } from './approved-ideas-list'
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
  rationale: 'Convierte porque crea urgencia',
  theme: null,
  created_at: '2026-06-07T00:00:00Z',
  client: { id: 'c1', name: "Joe's Gym" },
}

describe('ApprovedIdeasList', () => {
  it('shows an empty state when there are no approved ideas', () => {
    render(<ApprovedIdeasList ideas={[]} />)
    expect(screen.getByText(/Aún no hay ideas aprobadas/)).toBeInTheDocument()
  })

  it('renders each approved idea with its client, objective and hook', () => {
    render(<ApprovedIdeasList ideas={[idea]} />)
    expect(screen.getByText('Reto de 30 días')).toBeInTheDocument()
    expect(screen.getByText("Joe's Gym")).toBeInTheDocument()
    expect(screen.getByText('Empieza hoy')).toBeInTheDocument()
    expect(screen.getByText(/Conversion · BOFU/)).toBeInTheDocument()
  })
})
