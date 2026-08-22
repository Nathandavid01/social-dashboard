import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ContentIdea, RecordingSession } from '@/lib/supabase/types'
import { SessionIdeasPanel } from './session-ideas-panel'

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/actions/content-ideas', () => ({
  assignIdeaToSession: vi.fn(),
  markIdeaRecorded: vi.fn(),
  createContentIdeaManual: vi.fn(),
}))

vi.mock('./idea-video-loader', () => ({
  IdeaVideoLoader: ({ ideaId, ideaTitle }: { ideaId: string; ideaTitle?: string }) => (
    <div data-testid="subida">{ideaId}:{ideaTitle}</div>
  ),
}))

function session(over: Partial<RecordingSession> = {}): RecordingSession {
  return {
    id: 's1',
    session_date: '2026-08-20',
    client_id: 'c1',
    videographer_id: null,
    title: 'Grabación',
    notes: null,
    location: null,
    location_lat: null,
    location_lng: null,
    location_address: null,
    start_time: null,
    end_time: null,
    status: 'scheduled',
    created_by: 'u1',
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
    client: { id: 'c1', name: 'Blue' },
    ...over,
  }
}

function idea(over: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'i1',
    client_id: 'c1',
    content_type: 'R',
    title: 'El primer sandwich del día',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'idea',
    production_task_id: null,
    recording_session_id: 's1',
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: null,
    caption_draft: null,
    caption_platform: null,
    platform_formats: null,
    caption_generated_at: null,
    published_at: null,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    submitted_at: null,
    recording_date: null,
    publish_date: null,
    deadline: null,
    metricool_post_id: null,
    metricool_uuid: null,
    posted_at: null,
    posting_error: null,
    posting_started_at: null,
    created_by: 'u1',
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
    ...over,
  }
}

describe('SessionIdeasPanel — subida de crudo', () => {
  it('deja subir en una idea ligada aunque todavía no esté marcada grabada', () => {
    render(
      <SessionIdeasPanel
        open
        onClose={() => {}}
        session={session()}
        clientIdeas={[idea({ status: 'idea', recording_session_id: 's1' })]}
        onIdeasChange={() => {}}
        onEdit={() => {}}
      />,
    )
    expect(screen.getByTestId('subida')).toHaveTextContent('i1:El primer sandwich del día')
  })

  it('no muestra subida en ideas que no están en esta sesión', () => {
    render(
      <SessionIdeasPanel
        open
        onClose={() => {}}
        session={session()}
        clientIdeas={[idea({ id: 'i2', recording_session_id: null, title: 'Otra' })]}
        onIdeasChange={() => {}}
        onEdit={() => {}}
      />,
    )
    expect(screen.queryByTestId('subida')).not.toBeInTheDocument()
  })
})
