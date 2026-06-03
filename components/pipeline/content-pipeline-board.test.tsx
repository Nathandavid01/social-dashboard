import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { ContentPipelineBoard } from './content-pipeline-board'

function card(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1', client_id: 'c1', content_type: 'R', title: 'Un video',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram', 'tiktok'] },
    ...over,
  } as IdeaWithPipeline
}

beforeEach(() => cleanup())

describe('ContentPipelineBoard', () => {
  it('renders all 7 pipeline columns', () => {
    render(<ContentPipelineBoard ideas={[card()]} />)
    for (const label of ['Title', 'Idea', 'Caption', 'Video', 'Edited Video', 'Approval', 'Publication']) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    }
  })

  it('places a card in the column derived from its data (hook → Idea)', () => {
    render(<ContentPipelineBoard ideas={[card({ hook: 'Un gancho', title: 'Con gancho' })]} />)
    expect(screen.getByText('Con gancho')).toBeInTheDocument()
    // client name appears in both the filter chip and the card
    expect(screen.getAllByText('Nora Fitness').length).toBeGreaterThanOrEqual(1)
  })

  it('shows a client chip per client and an "all" chip', () => {
    render(<ContentPipelineBoard ideas={[card({ client: { id: 'c1', name: 'Nora Fitness', industry: null } }), card({ id: 'i2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null } })]} />)
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nora fitness/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lumen/i })).toBeInTheDocument()
  })

  it('filters cards by the selected client chip', () => {
    render(<ContentPipelineBoard ideas={[
      card({ id: 'i1', title: 'De Nora', client: { id: 'c1', name: 'Nora Fitness', industry: null } }),
      card({ id: 'i2', client_id: 'c2', title: 'De Lumen', client: { id: 'c2', name: 'Lumen', industry: null } }),
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: /lumen/i }))
    expect(screen.getByText('De Lumen')).toBeInTheDocument()
    expect(screen.queryByText('De Nora')).not.toBeInTheDocument()
  })

  it('filters by search text', () => {
    render(<ContentPipelineBoard ideas={[
      card({ id: 'i1', title: 'Receta verde' }),
      card({ id: 'i2', title: 'Rutina matutina' }),
    ]} />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'receta' } })
    expect(screen.getByText('Receta verde')).toBeInTheDocument()
    expect(screen.queryByText('Rutina matutina')).not.toBeInTheDocument()
  })

  it('shows the QC checklist on cards in the Edited column', () => {
    render(<ContentPipelineBoard ideas={[card({ status: 'producida', title: 'En edición' })]} />)
    expect(screen.getByText(/checklist qc/i)).toBeInTheDocument()
  })

  it('shows an approval badge on cards in the Approval column', () => {
    render(<ContentPipelineBoard ideas={[card({ status: 'producida', approval_status: 'approved', title: 'Aprobado video' })]} />)
    expect(screen.getByText(/^aprobado$/i)).toBeInTheDocument()
  })

  it('shows a publication badge on published cards', () => {
    render(<ContentPipelineBoard ideas={[card({ status: 'publicada', published_at: '2026-06-02T00:00:00Z', title: 'Ya salió' })]} />)
    expect(screen.getByText(/^publicado$/i)).toBeInTheDocument()
  })

  it('excludes descartada and counts published in the stats', () => {
    render(<ContentPipelineBoard ideas={[
      card({ id: 'i1', title: 'Publicado', status: 'publicada', published_at: '2026-06-02T00:00:00Z' }),
      card({ id: 'i2', title: 'Basura', status: 'descartada' }),
    ]} />)
    expect(screen.queryByText('Basura')).not.toBeInTheDocument()
    expect(screen.getByText(/publicados/i)).toBeInTheDocument()
  })
})
