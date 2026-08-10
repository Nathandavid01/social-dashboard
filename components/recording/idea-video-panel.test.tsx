import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

beforeEach(() => {
  canUpload = true
  vi.clearAllMocks()
})

describe('IdeaVideoPanel — compact upload view', () => {
  it('renders one uploader per group and summarizes what is missing', () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)

    expect(uploadSlots('video crudo')).toHaveLength(1)
    expect(uploadSlots('b-roll')).toHaveLength(1)
    expect(uploadSlots('video editado')).toHaveLength(1)
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })

  it('shows existing files plus one "Subir más" action', () => {
    const videos = [
      makeVideo('raw', 0),
      makeVideo('raw', 1),
      makeVideo('broll', 0),
      makeVideo('edited', 0),
    ]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)

    expect(uploadSlots('más video crudo')).toHaveLength(1)
    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('raw-1.mp4')).toBeInTheDocument()
    expect(uploadSlots('más b-roll')).toHaveLength(1)
    expect(uploadSlots('más video editado')).toHaveLength(1)
    expect(screen.getByText('Faltan 2')).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('keeps one uploader when the required count is complete', () => {
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo('raw', i))
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)

    videos.forEach((v) => expect(screen.getByText(v.name)).toBeInTheDocument())
    expect(uploadSlots('más video crudo')).toHaveLength(1)
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('ignores non-uploaded (e.g. archived) videos when counting filled slots', () => {
    const archived = { ...makeVideo('raw', 99), status: 'archived' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[archived]} />)

    expect(screen.queryByText('raw-99.mp4')).not.toBeInTheDocument()
    expect(uploadSlots('video crudo')).toHaveLength(1)
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — per-video status badges', () => {
  it('shows a "Subido" badge and the R2 storage tag for an uploaded R2 video', () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    expect(screen.getByText('Subido')).toBeInTheDocument()
    expect(screen.getAllByText('R2').length).toBeGreaterThan(0)
  })

  it('shows a "Público" badge ONLY for edited videos when public access is enabled', () => {
    const videos = [makeVideo('raw', 0), makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled />)
    // One Público badge — the edited one; the raw video is not public.
    expect(screen.getAllByText('Público')).toHaveLength(1)
  })

  it('does NOT show "Público" when public access is disabled', () => {
    const videos = [makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled={false} />)
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
  })

  it('does NOT mark a Drive-stored edited video as Público', () => {
    const driveEdited = { ...makeVideo('edited', 0), storage_provider: 'drive' as const, drive_view_link: 'https://drive/x' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), driveEdited]} publicEnabled />)
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
    expect(screen.getAllByText('Drive').length).toBeGreaterThan(0)
  })

  it('shows the upload time of an uploaded video', () => {
    const v = { ...makeVideo('edited', 0), uploaded_at: '2026-06-02T15:42:00.000Z' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), v]} />)
    // "subido <fecha/hora>" appears for the uploaded video.
    expect(screen.getAllByText(/subido/i).length).toBeGreaterThan(0)
  })

  it('labels Entregas R2 files with their real storage provider', () => {
    const entregasVideo = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregasVideo]} />)
    expect(screen.getByText('Entregas R2')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })

  it('shows the editor name from the joined uploader profile', () => {
    const v = { ...makeVideo('edited', 0), uploader: { id: 'user-1', full_name: 'Alexa Kerocen', email: 'alexa@example.com' } }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[v]} />)
    expect(screen.getByText(/subido por Alexa Kerocen/i)).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — permission gating', () => {
  it('does not render upload dropzones when the user lacks video.upload', () => {
    canUpload = false
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)

    // No uploadable "Subir ..." buttons.
    expect(screen.queryByText(/^Subir /i)).not.toBeInTheDocument()
    // The compact headers still communicate the missing requirements.
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — inline preview', () => {
  it('shows a "Ver" button for an uploaded R2 video', () => {
    canUpload = true
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })

  it('shows a "Ver" button for entregas-r2 videos so dual-R2 files stay viewable', () => {
    canUpload = true
    const entregas = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregas]} />)
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — multi-file upload', () => {
  it('every upload input accepts multiple files', () => {
    canUpload = true
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(3)
    inputs.forEach((input) => expect(input).toHaveAttribute('multiple'))
  })
})
