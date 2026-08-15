import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

/**
 * IdeaVideoPanel keeps uploads compact: existing files stay visible, each group
 * gets one multi-file uploader, and the header says what is still missing.
 */

// --- Mocks --------------------------------------------------------------

// Server actions are server-only ('use server'); stub them so the client
// component can import without pulling in Supabase/R2.
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'v1' })),
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  deleteR2Video: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview', provider: 'r2' })),
}))
vi.mock('@/lib/actions/video-analysis', () => ({
  getVideoAnalysis: vi.fn(async () => ({ analysis: null })),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/actions/video-thumbs', () => ({
  getVideoThumbViewUrls: vi.fn(async () => ({ urls: [] })),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Drives whether the user can see upload slots. Mutable across tests.
let canUpload = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => canUpload,
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { registerR2Video } from '@/lib/actions/idea-videos-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'

function makeVideo(kind: ContentIdeaVideoKind, i: number): ContentIdeaVideo {
  return {
    id: `${kind}-${i}`,
    idea_id: 'idea-1',
    kind,
    name: `${kind}-${i}.mp4`,
    drive_file_id: `ideas/idea-1/${kind}/${i}.mp4`,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 1024 * 1024,
    duration_sec: null,
    notes: null,
    uploaded_by: 'user-1',
    status: 'uploaded',
    error_message: null,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// An empty uploadable slot renders a "Subir <label>" button.
function uploadSlots(label: string) {
  return screen.queryAllByText(new RegExp(`^Subir ${label}$`, 'i'))
}

// The 'edited' SlotGroup always mounts VideoAnalysisReport, which resolves
// getVideoAnalysis (mocked) in a useEffect after mount. Flush that settle
// inside act() so React doesn't warn about an unwrapped state update.
async function flush() {
  await act(async () => {})
}

beforeEach(() => {
  canUpload = true
  vi.clearAllMocks()
})

describe('IdeaVideoPanel — compact upload view', () => {
  it('renders one uploader per group and summarizes what is missing', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    expect(uploadSlots('video crudo')).toHaveLength(1)
    expect(uploadSlots('b-roll')).toHaveLength(1)
    expect(uploadSlots('video editado')).toHaveLength(1)
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })

  it('shows existing files plus one "Subir más" action', async () => {
    const videos = [
      makeVideo('raw', 0),
      makeVideo('raw', 1),
      makeVideo('broll', 0),
      makeVideo('edited', 0),
    ]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)
    await flush()

    expect(uploadSlots('más video crudo')).toHaveLength(1)
    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('raw-1.mp4')).toBeInTheDocument()
    expect(uploadSlots('más b-roll')).toHaveLength(1)
    expect(uploadSlots('más video editado')).toHaveLength(1)
    expect(screen.getByText('Faltan 2')).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('keeps one uploader when the required count is complete', async () => {
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo('raw', i))
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)
    await flush()

    videos.forEach((v) => expect(screen.getByText(v.name)).toBeInTheDocument())
    expect(uploadSlots('más video crudo')).toHaveLength(1)
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('ignores non-uploaded (e.g. archived) videos when counting filled slots', async () => {
    const archived = { ...makeVideo('raw', 99), status: 'archived' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[archived]} />)
    await flush()

    expect(screen.queryByText('raw-99.mp4')).not.toBeInTheDocument()
    expect(uploadSlots('video crudo')).toHaveLength(1)
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — per-video status badges', () => {
  it('shows a "Subido" badge and the R2 storage tag for an uploaded R2 video', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.getByText('Subido')).toBeInTheDocument()
    expect(screen.getAllByText('R2').length).toBeGreaterThan(0)
  })

  it('shows a "Público" badge ONLY for edited videos when public access is enabled', async () => {
    const videos = [makeVideo('raw', 0), makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled />)
    await flush()
    // One Público badge — the edited one; the raw video is not public.
    expect(screen.getAllByText('Público')).toHaveLength(1)
  })

  it('does NOT show "Público" when public access is disabled', async () => {
    const videos = [makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled={false} />)
    await flush()
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
  })

  it('does NOT mark a Drive-stored edited video as Público', async () => {
    const driveEdited = { ...makeVideo('edited', 0), storage_provider: 'drive' as const, drive_view_link: 'https://drive/x' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), driveEdited]} publicEnabled />)
    await flush()
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
    expect(screen.getAllByText('Drive').length).toBeGreaterThan(0)
  })

  it('shows the upload time of an uploaded video', async () => {
    const v = { ...makeVideo('edited', 0), uploaded_at: '2026-06-02T15:42:00.000Z' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), v]} />)
    await flush()
    // "subido <fecha/hora>" appears for the uploaded video.
    expect(screen.getAllByText(/subido/i).length).toBeGreaterThan(0)
  })

  it('labels Entregas R2 files with their real storage provider', async () => {
    const entregasVideo = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregasVideo]} />)
    await flush()
    expect(screen.getByText('Entregas R2')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })

  it('shows the editor name from the joined uploader profile', async () => {
    const v = { ...makeVideo('edited', 0), uploader: { id: 'user-1', full_name: 'Alexa Kerocen', email: 'alexa@example.com' } }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[v]} />)
    await flush()
    expect(screen.getByText(/subido por Alexa Kerocen/i)).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — permission gating', () => {
  it('does not render upload dropzones when the user lacks video.upload', async () => {
    canUpload = false
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    // No uploadable "Subir ..." buttons.
    expect(screen.queryByText(/^Subir /i)).not.toBeInTheDocument()
    // The compact headers still communicate the missing requirements.
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — inline preview', () => {
  it('shows a "Ver" button for an uploaded R2 video', async () => {
    canUpload = true
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })

  it('shows a "Ver" button for entregas-r2 videos so dual-R2 files stay viewable', async () => {
    canUpload = true
    const entregas = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregas]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — dispara QC IA en subida de editado', () => {
  const OriginalXHR = global.XMLHttpRequest

  // getR2UploadUrl/registerR2Video are mocked at module scope; the actual
  // R2 PUT goes through XMLHttpRequest, which jsdom leaves unmocked (a real
  // request to it would hang). Stub it to succeed synchronously so uploadOne
  // reaches registerR2Video.
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
  })
  afterEach(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('subir en el slot "edited" dispara processUploadedVideo con el id registrado', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-9' })
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    const inputs = container.querySelectorAll('input[type="file"]')
    const editedInput = inputs[2] as HTMLInputElement
    const file = new File(['x'], 'final.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.change(editedInput, { target: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('vid-9', expect.any(File))
  })

  it('subir en el slot "raw" NO dispara processUploadedVideo', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-raw' })
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    const inputs = container.querySelectorAll('input[type="file"]')
    const rawInput = inputs[0] as HTMLInputElement
    const file = new File(['x'], 'raw.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.change(rawInput, { target: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(processUploadedVideo)).not.toHaveBeenCalled()
  })
})

describe('IdeaVideoPanel — tira de 5 escenas', () => {
  it('muestra la tira de 5 escenas debajo de un video editado', async () => {
    const { getVideoThumbViewUrls } = await import('@/lib/actions/video-thumbs')
    vi.mocked(getVideoThumbViewUrls).mockResolvedValue({
      urls: ['t0', 't1', 't2', 't3', 't4'],
    })
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('edited', 0)]} />)
    await flush()
    await flush()

    expect(screen.getAllByRole('img', { name: /^Escena \d/ })).toHaveLength(5)
  })

  it('no muestra la tira para videos crudos ni b-roll', async () => {
    const { getVideoThumbViewUrls } = await import('@/lib/actions/video-thumbs')
    vi.mocked(getVideoThumbViewUrls).mockResolvedValue({ urls: ['t0'] })
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), makeVideo('broll', 0)]} />)
    await flush()
    await flush()

    expect(screen.queryAllByRole('img', { name: /^Escena \d/ })).toHaveLength(0)
  })
})

describe('IdeaVideoPanel — multi-file upload', () => {
  it('every upload input accepts multiple files', async () => {
    canUpload = true
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(3)
    inputs.forEach((input) => expect(input).toHaveAttribute('multiple'))
  })
})
