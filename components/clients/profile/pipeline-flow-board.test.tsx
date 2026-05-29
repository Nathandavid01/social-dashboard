import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { ContentIdea } from '@/lib/supabase/types'
import { PipelineFlowBoard, currentStage, isOverdue } from './pipeline-flow-board'

// next/link → plain anchor in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const NOW = new Date('2026-05-29T12:00:00Z')

function makeIdea(over: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'idea-1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Un video',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea',
    production_task_id: null, recording_session_id: null, theme: null, generation_prompt: null, model: null,
    generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-05-28T12:00:00Z',
    updated_at: '2026-05-29T11:00:00Z', // recent by default → not stale
    ...over,
  } as ContentIdea
}

beforeEach(() => cleanup())

describe('currentStage — column placement', () => {
  it('idea/asignada → idea', () => {
    expect(currentStage(makeIdea({ status: 'idea' }))).toBe('idea')
    expect(currentStage(makeIdea({ status: 'asignada' }))).toBe('idea')
  })
  it('grabada → grabado', () => {
    expect(currentStage(makeIdea({ status: 'grabada' }))).toBe('grabado')
  })
  it('producida without caption → editado, with caption → caption', () => {
    expect(currentStage(makeIdea({ status: 'producida', generated_caption: null }))).toBe('editado')
    expect(currentStage(makeIdea({ status: 'producida', generated_caption: 'hola' }))).toBe('caption')
  })
  it('publicada → publicado', () => {
    expect(currentStage(makeIdea({ status: 'publicada' }))).toBe('publicado')
  })
})

describe('isOverdue', () => {
  it('past publish_date + not published → overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', publish_date: '2026-05-01' }), NOW)).toBe(true)
  })
  it('future publish_date + recent activity → not overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', publish_date: '2026-06-30' }), NOW)).toBe(false)
  })
  it('stale (updated_at older than 7 days) + not published → overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', updated_at: '2026-05-10T12:00:00Z' }), NOW)).toBe(true)
  })
  it('published is never overdue, even with a past publish_date', () => {
    expect(isOverdue(makeIdea({ status: 'publicada', publish_date: '2026-05-01', updated_at: '2026-01-01T00:00:00Z' }), NOW)).toBe(false)
  })
})

describe('PipelineFlowBoard', () => {
  it('renders the empty state when there are no (non-discarded) videos', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'd', status: 'descartada' })]} />)
    expect(screen.getByText(/sin videos en el pipeline/i)).toBeInTheDocument()
  })

  it('excludes descartada videos from the board', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'a', title: 'Vivo' }), makeIdea({ id: 'd', title: 'Descartado', status: 'descartada' })]} />)
    expect(screen.getByText('Vivo')).toBeInTheDocument()
    expect(screen.queryByText('Descartado')).not.toBeInTheDocument()
  })

  it('links each card to the idea detail', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'idea-42', title: 'Reel promo' })]} />)
    expect(screen.getByRole('link', { name: /reel promo/i })).toHaveAttribute('href', '/produccion/idea/idea-42')
  })

  it('flags an overdue card with a ⚠ (aria-label "atrasado")', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ status: 'grabada', publish_date: '2020-01-01' })]} />)
    expect(screen.getAllByLabelText(/atrasado/i).length).toBeGreaterThan(0)
  })

  it('does not flag a healthy card', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ status: 'grabada', publish_date: '2026-12-31' })]} />)
    expect(screen.queryByLabelText('atrasado')).not.toBeInTheDocument()
  })
})
