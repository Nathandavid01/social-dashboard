import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }))

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  getR2PreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview' })),
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'e1' })),
}))
vi.mock('@/lib/utils/video-frames', () => ({
  captureVideoFrames: vi.fn(async () => []),
}))
vi.mock('@/lib/actions/scene-check', () => ({
  analyzeUploadedVideo: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))

beforeEach(async () => {
  toastSpy.mockClear()
  const { analyzeUploadedVideo } = await import('@/lib/actions/scene-check')
  const { captureVideoFrames } = await import('@/lib/utils/video-frames')
  vi.mocked(analyzeUploadedVideo).mockClear()
  vi.mocked(captureVideoFrames).mockClear()
  // Minimal XHR stub — jsdom has no server, so `uploadOne`'s raw XHR PUT
  // needs a fake that resolves like a real 200 response.
  class FakeXHR {
    upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null }
    status = 200
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    send() {
      queueMicrotask(() => this.onload?.())
    }
  }
  // @ts-expect-error test stub
  global.XMLHttpRequest = FakeXHR
})

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

  it('la subida se confirma aunque el análisis AI falle', async () => {
    const { analyzeUploadedVideo } = await import('@/lib/actions/scene-check')
    vi.mocked(analyzeUploadedVideo).mockRejectedValueOnce(new Error('boom'))

    const { container } = render(<EditorVideoCard item={item} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'final-cut.mp4', { type: 'video/mp4' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Video editado subido' }),
      )
      expect(vi.mocked(analyzeUploadedVideo)).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 'e1', ideaId: 'v1' }),
      )
    })
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    )
  })

  it('con reporte error y sin archivo en memoria no aparece Reintentar', () => {
    const errored = {
      ...mat('edited', 0),
      status: 'uploaded' as const,
      scene_check: {
        status: 'error' as const,
        checkedAt: '2026-08-06T12:00:00Z',
        framesAnalyzed: 0,
        issues: [],
        videoTopic: null,
        error: 'Grok API 500',
      },
    }
    const withEdited: EditQueueItem = {
      video: { ...video(), videos: { raw: [], broll: [], edited: [errored] } } as unknown as PipelineVideo,
      client: { id: 'c1', name: 'Acme', logo_url: null },
    }
    render(<EditorVideoCard item={withEdited} />)
    expect(screen.getByText(/revisión ai no disponible/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reintentar/i })).not.toBeInTheDocument()
  })
})
