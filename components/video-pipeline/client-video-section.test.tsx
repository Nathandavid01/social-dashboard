import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import type { ClientAsset, SocialPlatform } from '@/lib/supabase/types'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/video-reviews',
  useSearchParams: () => new URLSearchParams(),
}))

// ClientLogo is a small presentational component — we render the real one so we can
// assert on the actual <img> or initials fallback. This gives us a true UI rendering test.
import { ClientVideoSection } from './client-video-section'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makePipeline(overrides: Partial<ClientVideoPipeline['client']> = {}): ClientVideoPipeline {
  const client: ClientVideoPipeline['client'] = {
    id: 'client-612',
    name: '612 C. Lounge',
    industry: 'Food & Beverage',
    status: 'active',
    platforms: ['instagram', 'facebook', 'tiktok'] as SocialPlatform[],
    logo_url: null,
    logo_dark_url: null,
    brand_colors: {},
    metricool_blog_id: null,
    posting_days: [],
    posting_time: null,
    ...overrides,
  }

  return {
    client,
    videos: [
      {
        id: 'idea-1',
        client_id: client.id,
        content_type: 'R',
        title: 'Reel verano',
        hook: null,
        visual_brief: null,
        caption_angle: null,
        hashtags_suggestion: null,
        rationale: null,
        status: 'idea',
        production_task_id: null,
        recording_session_id: null,
        theme: null,
        generation_prompt: null,
        model: null,
        generated_caption: null,
        caption_platform: null,
        caption_generated_at: null,
        published_at: null,
        approval_status: 'pending',
        approved_by: null,
        approved_at: null,
        submitted_at: null,
        recording_date: null,
        publish_date: null,
        created_by: null,
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-01T00:00:00Z',
        videos: { raw: [], broll: [], edited: [] },
      },
    ] as any,
    assets: [],
  }
}

describe('ClientVideoSection — client header logo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the client name, industry, platforms and video count', () => {
    const pipeline = makePipeline()
    render(<ClientVideoSection pipeline={pipeline} />)

    expect(screen.getByText('612 C. Lounge')).toBeInTheDocument()
    expect(screen.getByText('Food & Beverage')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('TikTok')).toBeInTheDocument()
    expect(screen.getByText('1 video')).toBeInTheDocument()
  })

  it('shows the uploaded logo as an <img> when logo_url is present (in the main client header)', () => {
    const pipeline = makePipeline({
      logo_url: 'https://cdn.example.com/logos/612.png',
    })
    render(<ClientVideoSection pipeline={pipeline} />)

    // Scope to the header so we target the big client logo, not the small one inside video cards
    const header = screen.getByRole('banner') || screen.getByRole('heading', { level: 1, hidden: true }).closest('header') || document.querySelector('header')!
    const headerEl = header instanceof HTMLElement ? header : (screen.getByText('612 C. Lounge').closest('header') as HTMLElement)

    const imgsInHeader = within(headerEl).getAllByAltText('612 C. Lounge')
    // The header logo should be the one we care about for this feature
    const headerLogo = imgsInHeader.find((el) => (el as HTMLImageElement).className.includes('h-')) as HTMLImageElement
    expect(headerLogo).toBeTruthy()
    expect(headerLogo.src).toBe('https://cdn.example.com/logos/612.png')
    // User requested h-8 w-8 for consistency with other client lists
    expect(headerLogo.className).toContain('h-8')
    expect(headerLogo.className).toContain('w-8')
  })

  it('falls back to initials when no logo_url is provided (in the main client header)', () => {
    const pipeline = makePipeline({ logo_url: null, name: '612 C. Lounge' })
    render(<ClientVideoSection pipeline={pipeline} />)

    const header = screen.getByText('612 C. Lounge').closest('header') as HTMLElement
    // In the header we should see the initials fallback (not an external logo img)
    expect(within(header).getByText('61')).toBeInTheDocument()

    // There should be no logo images coming from cdn in the header
    const headerImgs = within(header).queryAllByRole('img')
    const externalLogoImgs = headerImgs.filter((el) => {
      const src = (el as HTMLImageElement).src || ''
      return src.includes('cdn') || src.includes('logo')
    })
    expect(externalLogoImgs.length).toBe(0)
  })

  it('renders shared brand assets strip when present (logo asset etc)', () => {
    const pipeline = makePipeline()
    pipeline.assets = [
      {
        id: 'asset-logo',
        client_id: pipeline.client.id,
        kind: 'logo',
        name: 'Logo principal',
        url: 'https://cdn.example.com/brand/logo.png',
        mime_type: 'image/png',
        size_bytes: 12345,
        uploaded_at: '2026-01-01T00:00:00Z',
        uploaded_by: null,
      } as ClientAsset,
    ]

    render(<ClientVideoSection pipeline={pipeline} />)

    expect(screen.getByText('Assets compartidos')).toBeInTheDocument()
    expect(screen.getByText('Logo principal')).toBeInTheDocument()
  })
})
