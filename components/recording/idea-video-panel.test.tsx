import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

/**
 * IdeaVideoPanel must render the MINIMUM slot counts (>=4 raw, >=4 b-roll,
 * >=2 edited) — empty slots show as uploadable dropzones — and the per-group
 * "Agregar más" button must APPEND another empty slot.
 */

// --- Mocks --------------------------------------------------------------

// Server actions are server-only ('use server'); stub them so the client
// component can import without pulling in Supabase/R2.
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'v1' })),
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  getR2PreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview' })),
  deleteR2Video: vi.fn(async () => ({ ok: true })),
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

describe('IdeaVideoPanel — minimum slot counts', () => {
  it('renders >=4 raw, >=4 b-roll, >=2 edited empty slots when there are no videos', () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)

    expect(uploadSlots('video crudo')).toHaveLength(4)
    expect(uploadSlots('b-roll')).toHaveLength(4)
    // edited is gated behind "raw uploaded first" but the empty slots still render
    // as disabled dropzones (still "Subir video editado" buttons).
    expect(uploadSlots('video editado')).toHaveLength(2)
  })

  it('keeps the minimum slot count visible: filled videos + empty slots >= minimum', () => {
    const videos = [
      makeVideo('raw', 0),
      makeVideo('raw', 1),
      makeVideo('broll', 0),
      makeVideo('edited', 0),
    ]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)

    // 2 raw filled + 2 empty raw slots = 4 total visible (>= 4 minimum)
    expect(uploadSlots('video crudo')).toHaveLength(2)
    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('raw-1.mp4')).toBeInTheDocument()

    // 1 broll filled + 3 empty = 4 minimum maintained
    expect(uploadSlots('b-roll')).toHaveLength(3)

    // 1 edited filled + 1 empty = 2 minimum maintained
    expect(uploadSlots('video editado')).toHaveLength(1)
  })

  it('does not shrink below the minimum even when more than minimum videos exist', () => {
    // 5 raw videos (> 4 min): all render, with zero forced empties.
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo('raw', i))
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)

    videos.forEach((v) => expect(screen.getByText(v.name)).toBeInTheDocument())
    // 5 filled raw, no extra empty raw forced.
    expect(uploadSlots('video crudo')).toHaveLength(0)
  })

  it('ignores non-uploaded (e.g. archived) videos when counting filled slots', () => {
    const archived = { ...makeVideo('raw', 99), status: 'archived' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[archived]} />)

    // archived video not shown, full minimum of empty raw slots remains.
    expect(screen.queryByText('raw-99.mp4')).not.toBeInTheDocument()
    expect(uploadSlots('video crudo')).toHaveLength(4)
  })
})

describe('IdeaVideoPanel — "Agregar más" appends a slot', () => {
  it('appends one more empty slot to a group when "Agregar más" is clicked', () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)

    expect(uploadSlots('video crudo')).toHaveLength(4)

    const addRaw = screen.getByRole('button', { name: /Agregar más video crudo/i })
    fireEvent.click(addRaw)
    expect(uploadSlots('video crudo')).toHaveLength(5)

    fireEvent.click(addRaw)
    expect(uploadSlots('video crudo')).toHaveLength(6)

    // Other groups untouched.
    expect(uploadSlots('b-roll')).toHaveLength(4)
    expect(uploadSlots('video editado')).toHaveLength(2)
  })

  it('shows an "Agregar más" control for every group', () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    expect(screen.getByRole('button', { name: /Agregar más video crudo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar más b-roll/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar más video editado/i })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — permission gating', () => {
  it('does not render upload dropzones or "Agregar más" when the user lacks video.upload', () => {
    canUpload = false
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)

    // No uploadable "Subir ..." buttons.
    expect(screen.queryByText(/^Subir /i)).not.toBeInTheDocument()
    // No "Agregar más" buttons.
    expect(screen.queryByRole('button', { name: /Agregar más/i })).not.toBeInTheDocument()
    // Still shows the minimum read-only "pendiente" placeholders.
    expect(screen.getAllByText(/pendiente$/i).length).toBeGreaterThanOrEqual(4 + 4 + 2)
  })
})

describe('IdeaVideoPanel — inline preview', () => {
  it('shows a "Ver" button for an uploaded R2 video', () => {
    canUpload = true
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — multi-file upload', () => {
  it('every upload input accepts multiple files', () => {
    canUpload = true
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBeGreaterThan(0)
    inputs.forEach((input) => expect(input).toHaveAttribute('multiple'))
  })
})
