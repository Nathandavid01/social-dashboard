import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  getR2PreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview' })),
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'e1' })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))

function mat(kind: ContentIdeaVideo['kind'], i: number): ContentIdeaVideo {
  return {
    id: `${kind}-${i}`, kind, name: `${kind}-${i}.mp4`, status: 'uploaded',
    storage_provider: 'r2', drive_file_id: 'k', drive_view_link: null,
  } as ContentIdeaVideo
}

function video(): PipelineVideo {
  return {
    id: 'v1', client_id: 'c1', content_type: 'R', title: 'Reel 1', generated_caption: 'Mi caption',
    status: 'grabada', approval_status: 'pending', recording_date: null, publish_date: null,
    videos: { raw: [mat('raw', 0), mat('raw', 1)], broll: [mat('broll', 0)], edited: [] },
  } as unknown as PipelineVideo
}

const item: EditQueueItem = {
  video: video(),
  client: { id: 'c1', name: 'Acme', logo_url: null },
}

describe('EditorVideoCard', () => {
  it('lists crudos + b-roll source files with a download control each', () => {
    render(<EditorVideoCard item={item} />)
    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('raw-1.mp4')).toBeInTheDocument()
    expect(screen.getByText('broll-0.mp4')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Bajar/i })).toHaveLength(3)
  })

  it('renders the edited uploader (video, multiple)', () => {
    const { container } = render(<EditorVideoCard item={item} />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('multiple')
    expect(input).toHaveAttribute('accept', 'video/*')
    expect(screen.getByText(/Subir video editado/i)).toBeInTheDocument()
  })

  it('shows the caption and links the title to the workspace', () => {
    render(<EditorVideoCard item={item} />)
    expect(screen.getByText('Mi caption')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reel 1/i })).toHaveAttribute('href', '/produccion/idea/v1')
  })
})
