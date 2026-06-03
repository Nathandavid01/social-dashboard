import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { IdeaDetailSheet } from './idea-detail-sheet'

// Sheet (Radix dialog) renders into a portal; render children inline for jsdom.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// The reused detail components — render markers carrying the props we care about.
vi.mock('@/components/produccion/idea-progress-bar', () => ({
  IdeaProgressBar: ({ progress }: { progress: { percent: number } }) => (
    <div data-testid="progress">progress:{progress.percent}</div>
  ),
}))
vi.mock('@/components/produccion/idea-brief-card', () => ({
  IdeaBriefCard: ({ ideaId, hook }: { ideaId: string; hook?: string | null }) => (
    <div data-testid="brief">brief:{ideaId}:{hook}</div>
  ),
}))
vi.mock('@/components/produccion/idea-caption-editor', () => ({
  IdeaCaptionEditor: ({ ideaId, initialCaption }: { ideaId: string; initialCaption: string | null }) => (
    <div data-testid="caption">caption:{ideaId}:{initialCaption}</div>
  ),
}))
vi.mock('@/components/recording/idea-video-panel', () => ({
  IdeaVideoPanel: ({ ideaId, videos }: { ideaId: string; videos: unknown[] }) => (
    <div data-testid="videos">videos:{ideaId}:{videos.length}</div>
  ),
}))
vi.mock('@/components/produccion/idea-activity-timeline', () => ({
  IdeaActivityTimeline: ({ activities }: { activities: unknown[] }) => (
    <div data-testid="activity">activity:{activities.length}</div>
  ),
}))

const getIdeaDetailBundle = vi.fn<(id: string) => Promise<{ bundle?: unknown; error?: string }>>()
vi.mock('@/lib/actions/content-ideas', () => ({
  getIdeaDetailBundle: (id: string) => getIdeaDetailBundle(id),
}))

function makeBundle() {
  return {
    idea: {
      id: 'idea-1',
      title: 'Mi Reel',
      content_type: 'R',
      hook: 'El hook',
      visual_brief: null,
      caption_angle: null,
      hashtags_suggestion: null,
      publish_date: null,
      generated_caption: 'Caption guardado',
      caption_platform: 'instagram',
    },
    videos: [{ id: 'v1' }, { id: 'v2' }],
    assets: [{ id: 'a1' }],
    activity: [{ id: 'act1' }],
    progress: { stages: [], completed: 2, total: 7, percent: 29, missing: [] },
  }
}

beforeEach(() => {
  cleanup()
  getIdeaDetailBundle.mockReset()
})

describe('IdeaDetailSheet', () => {
  it('does not fetch while closed', () => {
    render(<IdeaDetailSheet ideaId={null} open={false} onOpenChange={() => {}} />)
    expect(getIdeaDetailBundle).not.toHaveBeenCalled()
  })

  it('fetches the bundle on open and mounts all five detail sections', async () => {
    getIdeaDetailBundle.mockResolvedValue({ bundle: makeBundle() })
    render(<IdeaDetailSheet ideaId="idea-1" open onOpenChange={() => {}} />)

    await waitFor(() => expect(screen.getByTestId('brief')).toBeInTheDocument())
    expect(getIdeaDetailBundle).toHaveBeenCalledWith('idea-1')

    expect(screen.getByText('Mi Reel')).toBeInTheDocument()
    expect(screen.getByTestId('progress')).toHaveTextContent('progress:29')
    expect(screen.getByTestId('brief')).toHaveTextContent('brief:idea-1:El hook')
    expect(screen.getByTestId('caption')).toHaveTextContent('caption:idea-1:Caption guardado')
    expect(screen.getByTestId('videos')).toHaveTextContent('videos:idea-1:2')
    expect(screen.getByTestId('activity')).toHaveTextContent('activity:1')
  })

  it('shows an error message when the fetch fails', async () => {
    getIdeaDetailBundle.mockResolvedValue({ error: 'Idea no encontrada' })
    render(<IdeaDetailSheet ideaId="missing" open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByText('Idea no encontrada')).toBeInTheDocument())
    expect(screen.queryByTestId('brief')).not.toBeInTheDocument()
  })
})
