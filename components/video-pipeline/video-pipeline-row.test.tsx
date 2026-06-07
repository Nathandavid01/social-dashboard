import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoPipelineRow } from './video-pipeline-row'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

vi.mock('@/components/produccion/approval-button', () => ({
  ApprovalButton: ({ ideaId }: { ideaId: string }) => <button data-idea={ideaId}>Enviar a revisión</button>,
}))

vi.mock('@/components/produccion/publish-metricool-button', () => ({
  PublishToMetricoolButton: ({ ideaId }: { ideaId: string }) => <button data-publish={ideaId}>Publicar a Metricool</button>,
}))

function video(over: Partial<PipelineVideo> = {}): PipelineVideo {
  return {
    id: 'v1', client_id: 'c1', content_type: 'C', title: 'Promo del finde',
    hook: 'h', visual_brief: 'b', caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'asignada', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: 'Mi caption', caption_platform: 'instagram',
    caption_generated_at: null, published_at: null, approval_status: 'pending', approved_by: null,
    approved_at: null, submitted_at: null, recording_date: '2026-05-10', publish_date: '2026-05-15',
    created_by: null, created_at: '', updated_at: '',
    videos: { raw: [], broll: [], edited: [] },
    ...over,
  } as PipelineVideo
}

function row(v: PipelineVideo) {
  return render(<table><tbody><VideoPipelineRow video={v} assetCount={0} /></tbody></table>)
}

describe('VideoPipelineRow', () => {
  it('renders the title as a link to the workspace', () => {
    row(video())
    expect(screen.getByRole('link', { name: /Promo del finde/i })).toHaveAttribute('href', '/produccion/idea/v1')
  })

  it('shows the 7 progress segments', () => {
    row(video())
    expect(screen.getAllByTestId('row-stage-segment')).toHaveLength(7)
  })

  it('shows material counts (crudos/b-roll 0/4, edited 0/2) and both dates', () => {
    row(video())
    expect(screen.getAllByText('0/4')).toHaveLength(2)
    expect(screen.getByText('0/2')).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })

  it('renders the approval action and the caption subtitle', () => {
    row(video())
    expect(screen.getByText('Enviar a revisión')).toBeInTheDocument()
    expect(screen.getByText('Mi caption')).toBeInTheDocument()
  })

  it('does not render caption text when there is no caption', () => {
    row(video({ generated_caption: null }))
    expect(screen.queryByText('Mi caption')).not.toBeInTheDocument()
    // The row still renders the title.
    expect(screen.getByRole('link', { name: /Promo del finde/i })).toBeInTheDocument()
  })
})

describe('VideoPipelineRow — brand-color accent (client identity)', () => {
  it('applies the client brand color as a left accent on the first cell', () => {
    const { container } = render(
      <table><tbody><VideoPipelineRow video={video()} assetCount={0} accentColor="#3E64DE" /></tbody></table>,
    )
    const firstCell = container.querySelector('td')
    expect(firstCell).toHaveStyle({ borderLeftColor: '#3E64DE' })
  })

  it('has no inline left-accent color when none is provided', () => {
    const { container } = render(
      <table><tbody><VideoPipelineRow video={video()} assetCount={0} /></tbody></table>,
    )
    const firstCell = container.querySelector('td') as HTMLElement
    expect(firstCell.style.borderLeftColor).toBe('')
  })
})
