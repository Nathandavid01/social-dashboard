import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientIdeasRows } from './client-ideas-rows'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1', client_id: 'c1', content_type: 'R', title: 'Reel 1', hook: 'h', visual_brief: 'b',
    caption_angle: null, hashtags_suggestion: null, rationale: null, status: 'idea',
    production_task_id: null, recording_session_id: null, theme: null, generation_prompt: null,
    model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null,
    submitted_at: null, recording_date: '2026-05-10', publish_date: '2026-05-15',
    created_by: null, created_at: '', updated_at: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: { id: 'c1', name: 'Acme', industry: null, logo_url: null, platforms: [] } as any,
    recordingScheduled: false, videos: [],
    ...over,
  } as IdeaWithPipeline
}

describe('ClientIdeasRows', () => {
  it('groups ideas by client and renders a row per video', () => {
    render(<ClientIdeasRows ideas={[idea(), idea({ id: 'i2', title: 'Reel 2' })]} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Reel 1')).toBeInTheDocument()
    expect(screen.getByText('Reel 2')).toBeInTheDocument()
    expect(screen.getByText('2 videos')).toBeInTheDocument()
  })

  it('shows both dates per video', () => {
    render(<ClientIdeasRows ideas={[idea()]} />)
    expect(screen.getByText(/10/)).toBeInTheDocument() // recording day
    expect(screen.getByText(/15/)).toBeInTheDocument() // publish day
  })

  it('separates ideas from different clients into their own sections', () => {
    render(
      <ClientIdeasRows
        ideas={[
          idea(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          idea({ id: 'i9', client_id: 'c2', title: 'Otro', client: { id: 'c2', name: 'Beta', industry: null, logo_url: null, platforms: [] } as any }),
        ]}
      />,
    )
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})
