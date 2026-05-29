import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type {
  ContentIdeaVideo,
  ContentIdeaVideoKind,
  ContentIdeaVideoStatus,
} from '@/lib/supabase/types'
import type { PipelineVideo, PipelineVideoSlots } from '@/lib/actions/video-pipeline'

// ── Mocks ──────────────────────────────────────────────────────────────────────
// next/navigation: VideoCard uses next/link (App Router). Mock defensively in case
// Link or a child reaches for the router during render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/video-reviews',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}))

// Server actions ('use server' → import server-only supabase) must be mocked.
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://example.com/file' })),
  getR2UploadUrl: vi.fn(),
  registerR2Video: vi.fn(),
  deleteR2Video: vi.fn(),
}))

// ApprovalButton is owned by another task and may import server-only/role code.
// Render a stand-in that echoes the props we care about.
vi.mock('@/components/produccion/approval-button', () => ({
  ApprovalButton: ({ ideaId, approvalStatus }: { ideaId: string; approvalStatus: string }) => (
    <div data-testid="approval-button" data-idea-id={ideaId} data-approval-status={approvalStatus}>
      approval-button
    </div>
  ),
}))

// Toast hook is a client hook with no server deps; mock to keep tests isolated.
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Imported after mocks are registered.
import { VideoCard } from '@/components/video-pipeline/video-card'

// ── Fixtures ────────────────────────────────────────────────────────────────────
let idCounter = 0

function makeVideo(
  kind: ContentIdeaVideoKind,
  overrides: Partial<ContentIdeaVideo> = {},
): ContentIdeaVideo {
  idCounter += 1
  return {
    id: `vid-${idCounter}`,
    idea_id: 'idea-1',
    kind,
    name: `${kind}-clip-${idCounter}`,
    drive_file_id: 'r2-key',
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 1000,
    duration_sec: 10,
    notes: null,
    uploaded_by: null,
    status: 'uploaded' as ContentIdeaVideoStatus,
    error_message: null,
    uploaded_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

function slots(counts: { raw?: number; broll?: number; edited?: number } = {}): PipelineVideoSlots {
  const build = (kind: ContentIdeaVideoKind, n: number) =>
    Array.from({ length: n }, () => makeVideo(kind))
  return {
    raw: build('raw', counts.raw ?? 0),
    broll: build('broll', counts.broll ?? 0),
    edited: build('edited', counts.edited ?? 0),
  }
}

function makeVideoCard(overrides: Partial<PipelineVideo> = {}): PipelineVideo {
  const videoSlots = overrides.videos ?? slots()
  return {
    id: 'idea-1',
    client_id: 'client-1',
    content_type: 'R',
    title: 'Mi primer reel',
    hook: 'Un gancho potente',
    visual_brief: 'Brief visual',
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'producida',
    production_task_id: null,
    recording_session_id: null,
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: 'Este es el caption generado',
    caption_platform: 'instagram',
    caption_generated_at: '2026-05-01T00:00:00Z',
    published_at: null,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    submitted_at: null,
    recording_date: '2026-05-10',
    publish_date: '2026-05-15',
    created_by: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    videos: videoSlots,
    ...overrides,
  }
}

beforeEach(() => {
  idCounter = 0
})

// ── Slot counts / classification per kind (min 4/4/2) ───────────────────────────
describe('VideoCard — slot summary counts', () => {
  it('renders all slots full (4 raw / 4 broll / 2 edited) with reached counts', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 4, broll: 4, edited: 2 }) })} />)

    expect(screen.getByText('Crudos')).toBeInTheDocument()
    expect(screen.getByText('B-roll')).toBeInTheDocument()
    expect(screen.getByText('Editados')).toBeInTheDocument()

    // edited count.
    expect(screen.getByText('2/2')).toBeInTheDocument()
    // raw and broll both render "4/4"; assert there are exactly two of them.
    expect(screen.getAllByText('4/4')).toHaveLength(2)
  })

  it('classifies videos by kind: no "vacío" placeholders when every slot has content', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 4, broll: 4, edited: 2 }) })} />)
    expect(screen.queryByText('vacío')).not.toBeInTheDocument()
  })

  it('renders partial slots (2 of 4) with un-reached counts', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 2, broll: 2, edited: 1 }) })} />)
    expect(screen.getAllByText('2/4')).toHaveLength(2) // raw + broll partial
    expect(screen.getByText('1/2')).toBeInTheDocument() // edited partial
    expect(screen.queryByText('vacío')).not.toBeInTheDocument()
  })

  it('renders all-empty slots with 0/min counts and "vacío" placeholders', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 0, broll: 0, edited: 0 }) })} />)
    expect(screen.getAllByText('0/4')).toHaveLength(2) // raw + broll
    expect(screen.getByText('0/2')).toBeInTheDocument() // edited
    expect(screen.getAllByText('vacío')).toHaveLength(3) // one per empty kind
  })

  it('only counts active videos (ignores archived/failed) toward the slot fill', () => {
    const videoSlots = slots({ raw: 2 })
    videoSlots.raw.push(makeVideo('raw', { status: 'archived' }))
    videoSlots.raw.push(makeVideo('raw', { status: 'failed' }))
    render(<VideoCard video={makeVideoCard({ videos: videoSlots })} />)
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })

  it('caps visible chips at 4 and shows a "+N" overflow indicator', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 6 }) })} />)
    expect(screen.getByText('6/4')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})

// ── Caption rendering ───────────────────────────────────────────────────────────
describe('VideoCard — caption', () => {
  it('renders the caption preview and platform when present', () => {
    render(<VideoCard video={makeVideoCard()} />)
    expect(screen.getByText('Este es el caption generado')).toBeInTheDocument()
    expect(screen.getByText('Caption')).toBeInTheDocument()
    expect(screen.getByText('instagram')).toBeInTheDocument()
  })

  it('shows a "Sin caption" fallback when there is no caption', () => {
    render(
      <VideoCard video={makeVideoCard({ generated_caption: null, caption_platform: null })} />,
    )
    expect(screen.getByText('Sin caption generado')).toBeInTheDocument()
    // The only "Caption" is the stage chip; the caption preview header is not rendered.
    expect(screen.queryAllByText('Caption')).toHaveLength(1)
  })

  it('treats a whitespace-only caption as empty', () => {
    render(<VideoCard video={makeVideoCard({ generated_caption: '   ' })} />)
    expect(screen.getByText('Sin caption generado')).toBeInTheDocument()
  })
})

// ── Dates ───────────────────────────────────────────────────────────────────────
describe('VideoCard — dates', () => {
  it('renders recording and publish dates when present', () => {
    render(<VideoCard video={makeVideoCard()} />)
    expect(screen.getByText(/Grabación:/)).toBeInTheDocument()
    expect(screen.getByText(/Publicación:/)).toBeInTheDocument()
    expect(screen.queryByText(/Grabación: —/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Publicación: —/)).not.toBeInTheDocument()
  })

  it('renders an em-dash placeholder when both dates are null', () => {
    render(<VideoCard video={makeVideoCard({ recording_date: null, publish_date: null })} />)
    expect(screen.getByText(/Grabación: —/)).toBeInTheDocument()
    expect(screen.getByText(/Publicación: —/)).toBeInTheDocument()
  })

  it('handles one null date independently (recording set, publish null)', () => {
    render(<VideoCard video={makeVideoCard({ publish_date: null })} />)
    expect(screen.queryByText(/Grabación: —/)).not.toBeInTheDocument()
    expect(screen.getByText(/Publicación: —/)).toBeInTheDocument()
  })

  it('renders the em-dash placeholder for an invalid date string', () => {
    render(<VideoCard video={makeVideoCard({ recording_date: 'not-a-date' })} />)
    expect(screen.getByText(/Grabación: —/)).toBeInTheDocument()
  })
})

// ── Header: title, type/status/approval badges ──────────────────────────────────
describe('VideoCard — header & badges', () => {
  it('renders the title, type, status and approval badges', () => {
    render(<VideoCard video={makeVideoCard()} />)
    expect(screen.getByText('Mi primer reel')).toBeInTheDocument()
    expect(screen.getByText('Reel')).toBeInTheDocument() // type R
    expect(screen.getByText('En producción')).toBeInTheDocument() // status producida
    expect(screen.getByText('Sin enviar')).toBeInTheDocument() // approval pending
  })

  it('falls back to "Sin título" when title is empty', () => {
    render(<VideoCard video={makeVideoCard({ title: '' })} />)
    expect(screen.getByText('Sin título')).toBeInTheDocument()
  })

  it('reflects approval status in the approval badge', () => {
    render(<VideoCard video={makeVideoCard({ approval_status: 'approved' })} />)
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
  })

  it('links the card to the idea workspace', () => {
    render(<VideoCard video={makeVideoCard()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/produccion/idea/idea-1')
  })
})

// ── Brief / hook ────────────────────────────────────────────────────────────────
describe('VideoCard — brief / hook', () => {
  it('prefers the hook when present', () => {
    render(<VideoCard video={makeVideoCard()} />)
    expect(screen.getByText('Un gancho potente')).toBeInTheDocument()
  })

  it('falls back to the visual brief when there is no hook', () => {
    render(<VideoCard video={makeVideoCard({ hook: null })} />)
    expect(screen.getByText('Brief visual')).toBeInTheDocument()
  })

  it('shows a "Sin brief ni hook" fallback when both are missing', () => {
    render(<VideoCard video={makeVideoCard({ hook: null, visual_brief: null })} />)
    expect(screen.getByText('Sin brief ni hook')).toBeInTheDocument()
  })
})

// ── Approval button wiring ──────────────────────────────────────────────────────
describe('VideoCard — approval button', () => {
  it('passes the idea id and approval status to the ApprovalButton', () => {
    render(<VideoCard video={makeVideoCard({ approval_status: 'submitted' })} />)
    const btn = screen.getByTestId('approval-button')
    expect(btn).toHaveAttribute('data-idea-id', 'idea-1')
    expect(btn).toHaveAttribute('data-approval-status', 'submitted')
  })
})

// ── Full empty card (no caption, no dates, no slots) ─────────────────────────────
describe('VideoCard — fully empty idea', () => {
  it('renders all empty/fallback states together without crashing', () => {
    render(
      <VideoCard
        video={makeVideoCard({
          title: '',
          hook: null,
          visual_brief: null,
          generated_caption: null,
          caption_platform: null,
          recording_date: null,
          publish_date: null,
          videos: slots({ raw: 0, broll: 0, edited: 0 }),
        })}
      />,
    )
    expect(screen.getByText('Sin título')).toBeInTheDocument()
    expect(screen.getByText('Sin brief ni hook')).toBeInTheDocument()
    expect(screen.getByText('Sin caption generado')).toBeInTheDocument()
    expect(screen.getAllByText('vacío')).toHaveLength(3)
    expect(screen.getByText(/Grabación: —/)).toBeInTheDocument()
    expect(screen.getByText(/Publicación: —/)).toBeInTheDocument()
    expect(screen.getByTestId('approval-button')).toBeInTheDocument()
  })
})

// ── Slot chips: render targets per storage provider ─────────────────────────────
describe('VideoCard — slot chips', () => {
  it('renders an R2 video as a download button', () => {
    render(
      <VideoCard
        video={makeVideoCard({
          videos: { ...slots(), raw: [makeVideo('raw', { name: 'crudo-uno', storage_provider: 'r2' })] },
        })}
      />,
    )
    // The chip's accessible name is its visible text; the action is in the title.
    const btn = screen.getByTitle('Descargar crudo-uno')
    expect(btn.tagName).toBe('BUTTON')
    expect(screen.getByText('crudo-uno')).toBeInTheDocument()
  })

  it('renders a Drive video with a view link', () => {
    render(
      <VideoCard
        video={makeVideoCard({
          videos: {
            ...slots(),
            raw: [
              makeVideo('raw', {
                name: 'crudo-drive',
                storage_provider: 'drive',
                drive_file_id: null,
                drive_view_link: 'https://drive.google.com/view',
              }),
            ],
          },
        })}
      />,
    )
    const link = screen.getByTitle('Abrir crudo-drive en Drive')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://drive.google.com/view')
  })
})

// ── Stage progress chips ────────────────────────────────────────────────────────
describe('VideoCard — stage progress chips', () => {
  it('renders the stage chip row (incl. Aprobación + Publicado)', () => {
    render(<VideoCard video={makeVideoCard()} assetCount={2} />)
    // "Aprobación" and "Publicado" are unique to the chip row (badges use other labels).
    expect(screen.getByText('Aprobación')).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
  })

  it('shows a material count chip derived from active videos', () => {
    render(<VideoCard video={makeVideoCard({ videos: slots({ raw: 1 }) })} assetCount={0} />)
    expect(screen.getByText('Material 1/4')).toBeInTheDocument()
  })
})

// ── Client logo ─────────────────────────────────────────────────────────────────
describe('VideoCard — client logo', () => {
  it('renders the client logo image when a url is provided', () => {
    render(<VideoCard video={makeVideoCard()} clientName="Acme" clientLogoUrl="https://logo.png" />)
    expect(screen.getByAltText('Acme')).toBeInTheDocument()
  })

  it('falls back to initials when there is no logo url', () => {
    render(<VideoCard video={makeVideoCard()} clientName="Acme Corp" clientLogoUrl={null} />)
    expect(screen.getByText('AC')).toBeInTheDocument()
  })
})
