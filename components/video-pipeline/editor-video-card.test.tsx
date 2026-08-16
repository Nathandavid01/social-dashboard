import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'
import { registerR2Video } from '@/lib/actions/idea-videos-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'e1' })),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview', provider: 'r2' })),
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
  })
})

describe('EditorVideoCard — dispara QC IA al subir editado', () => {
  const OriginalXHR = global.XMLHttpRequest
  class FakeXHR {
    status = 200
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    send() {
      this.onload?.()
    }
  }

  beforeEach(() => {
    // @ts-expect-error test stub, not a full XMLHttpRequest
    global.XMLHttpRequest = FakeXHR
    vi.mocked(processUploadedVideo).mockClear()
  })
  afterEach(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('subir el editado dispara processUploadedVideo con el id registrado', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-edit' })
    const { container } = render(<EditorVideoCard item={item} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'final.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('vid-edit', expect.any(File))
  })
})
