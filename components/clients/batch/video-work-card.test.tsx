/**
 * Tests for the batch video work card (components/clients/batch/video-work-card.tsx).
 *
 * Design decision: the approval action lives ON the video card in the batch
 * ("el botón de aprobado tiene que salir aquí"). The card renders the shared
 * ApprovalButton, so the right action shows for the video's approval_status and
 * the user's role. The heavy inline-editor children are mocked away; the
 * ApprovalButton is exercised for real (its actions + auth context are mocked).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { UserRole } from '@/lib/supabase/types'

vi.mock('@/components/produccion/idea-brief-card', () => ({ IdeaBriefCard: () => null }))
vi.mock('@/components/produccion/idea-caption-editor', () => ({ IdeaCaptionEditor: () => null }))
vi.mock('@/components/recording/idea-video-panel', () => ({
  IdeaVideoPanel: () => <div data-testid="idea-video-panel" />,
}))
vi.mock('@/components/recording/video-scene-strip', () => ({
  VideoSceneStrip: ({ videoId }: { videoId: string }) => <div data-testid="scene-strip" data-video-id={videoId} />,
}))
vi.mock('@/components/video-analysis/qc-progress-dots', () => ({
  QcProgressDots: ({ ideaId, videoId }: { ideaId: string; videoId?: string }) => (
    <div data-testid="qc-dots" data-idea-id={ideaId} data-video-id={videoId ?? ''} />
  ),
}))
vi.mock('@/components/shared/inline-edit', () => ({
  InlineEdit: ({ value }: { value?: string | null }) => <span>{value}</span>,
}))
vi.mock('@/lib/actions/content-ideas', () => ({ updateIdeaTitle: vi.fn() }))

vi.mock('@/lib/actions/idea-approval', () => ({
  submitIdeaForApproval: vi.fn(async () => ({ ok: true as const })),
  approveIdea: vi.fn(async () => ({ ok: true as const })),
  requestRevision: vi.fn(async () => ({ ok: true as const })),
}))
vi.mock('@/lib/actions/idea-posting', () => ({
  publishIdeaToMetricool: vi.fn(async () => ({ ok: true as const })),
}))
let mockRole: UserRole | null = 'supervisor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { VideoWorkCard } from './video-work-card'
import type { BatchVideo } from '@/lib/utils/batch-view'

function video(over: Partial<BatchVideo> = {}): BatchVideo {
  return {
    id: 'i1',
    title: 'Rutina de fuerza 5x5',
    content_type: 'R',
    approval_status: 'submitted',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    generated_caption: null,
    publish_date: null,
    status: 'producida',
    videos: { raw: [], broll: [], edited: [] },
    ...over,
  } as unknown as BatchVideo
}

afterEach(() => cleanup())

describe('VideoWorkCard — aprobación en el lote', () => {
  it('lets an authorised user approve / request changes when submitted', () => {
    mockRole = 'supervisor'
    render(<VideoWorkCard video={video({ approval_status: 'submitted' })} index={0} clientName="Costa Sur Gym" />)
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pedir revisión/i })).toBeInTheDocument()
  })

  it('shows the approved state once approved', () => {
    mockRole = 'supervisor'
    render(<VideoWorkCard video={video({ approval_status: 'approved' })} index={0} clientName="Costa Sur Gym" />)
    // Both the "Aprobado" badge and the next-step hint mention the approval.
    expect(screen.getAllByText(/aprobado/i).length).toBeGreaterThanOrEqual(1)
  })

  it('explains the lack of permission for non-approvers', () => {
    mockRole = 'video'
    render(<VideoWorkCard video={video({ approval_status: 'submitted' })} index={0} />)
    expect(screen.getByText(/sin permiso para aprobar/i)).toBeInTheDocument()
  })

  it('does not gate recording on a saved caption (video may already be recorded)', () => {
    mockRole = 'video'
    render(<VideoWorkCard video={video({ generated_caption: null })} index={0} clientName="Costa Sur Gym" />)
    // Short pipeline: the video is already recorded/scheduled, so recording is
    // never blocked behind saving the caption first.
    expect(screen.queryByText(/antes de grabar/i)).not.toBeInTheDocument()
  })
})

describe('VideoWorkCard — publicación profesional (hint + Metricool)', () => {
  it('shows the next-step hint for the video state', () => {
    mockRole = 'supervisor'
    render(<VideoWorkCard video={video({ approval_status: 'pending', generated_caption: null })} index={0} />)
    expect(screen.getByText(/siguiente: genera el caption/i)).toBeInTheDocument()
  })

  it('offers "Publicar a Metricool" once approved (for posting.publish roles)', () => {
    mockRole = 'supervisor'
    render(
      <VideoWorkCard
        video={video({
          approval_status: 'approved',
          generated_caption: 'listo',
          videos: { raw: [], broll: [], edited: [{ id: 'e1' }] },
        } as never)}
        index={0}
        clientName="Costa Sur Gym"
      />,
    )
    expect(screen.getByRole('button', { name: /publicar a metricool/i })).toBeInTheDocument()
    expect(screen.getByText(/aprobado — listo para metricool/i)).toBeInTheDocument()
  })

  it('warns when an approved video is missing the caption for Metricool', () => {
    mockRole = 'supervisor'
    render(<VideoWorkCard video={video({ approval_status: 'approved', generated_caption: null })} index={0} />)
    expect(screen.getByText(/aprobado — falta el caption/i)).toBeInTheDocument()
  })

  it('shows the publish error detail with a retry path when posting failed', () => {
    mockRole = 'supervisor'
    render(
      <VideoWorkCard
        video={video({ approval_status: 'approved', posting_error: 'La URL del video no responde (503)' } as never)}
        index={0}
      />,
    )
    // The next-step line flags it AND the raw error is visible so the team knows WHAT failed.
    expect(screen.getByText(/error al publicar — revisa y reintenta/i)).toBeInTheDocument()
    expect(screen.getByText(/la url del video no responde \(503\)/i)).toBeInTheDocument()
    // Retry = the same publish button, still available.
    expect(screen.getByRole('button', { name: /publicar a metricool/i })).toBeInTheDocument()
  })

  it('shows the "En Metricool" badge instead of the button once scheduled', () => {
    mockRole = 'supervisor'
    render(
      <VideoWorkCard
        video={video({ approval_status: 'approved', metricool_post_id: 555 } as never)}
        index={0}
      />,
    )
    expect(screen.queryByRole('button', { name: /publicar a metricool/i })).not.toBeInTheDocument()
    // Both the "En Metricool" badge and the "Programado en Metricool" hint show.
    expect(screen.getAllByText(/en metricool/i).length).toBeGreaterThanOrEqual(1)
  })
})

describe('VideoWorkCard — agenda de publicación (fecha, hora, formato)', () => {
  it('shows date, time and grouped format when everything is known', () => {
    render(
      <VideoWorkCard
        video={video({
          content_type: 'R',
          publish_date: '2026-08-17', // Monday
          platform_formats: { instagram: 'reel', facebook: 'reel' },
        } as never)}
        index={0}
        platforms={['instagram', 'facebook'] as never}
        postingTime="15:20"
      />,
    )
    expect(screen.getByText(/se publica el lun 17 ago/i)).toBeInTheDocument()
    expect(screen.getByText(/3:20 p\. m\./)).toBeInTheDocument()
    expect(screen.getByText(/reel en instagram y facebook/i)).toBeInTheDocument()
  })

  it('shows "sin fecha de publicación" and fabricates neither a time nor a format', () => {
    render(
      <VideoWorkCard
        video={video({ content_type: 'R', publish_date: null } as never)}
        index={0}
        platforms={['instagram', 'facebook'] as never}
        postingTime="15:20"
      />,
    )
    expect(screen.getByText(/sin fecha de publicación/i)).toBeInTheDocument()
    expect(screen.queryByText(/p\. m\.|a\. m\./)).not.toBeInTheDocument()
    expect(screen.queryByText(/reel en/i)).not.toBeInTheDocument()
  })

  it('shows the date and flags the time as not configured, without a fake default', () => {
    render(
      <VideoWorkCard
        video={video({ content_type: 'R', publish_date: '2026-08-17' } as never)}
        index={0}
        platforms={['instagram'] as never}
        postingTime={null}
      />,
    )
    expect(screen.getByText(/se publica el lun 17 ago/i)).toBeInTheDocument()
    expect(screen.getByText(/hora no configurada/i)).toBeInTheDocument()
  })

  it('flags a past publish_date with the shared "se corre a +24h" wording', () => {
    render(
      <VideoWorkCard
        video={video({ content_type: 'R', publish_date: '2020-01-01' } as never)}
        index={0}
        platforms={['instagram'] as never}
        postingTime="10:00"
      />,
    )
    expect(screen.getByText(/fecha pasada — se corre a \+24h/i)).toBeInTheDocument()
  })

  it('shows Post (not Reel) for a Post-type video', () => {
    render(
      <VideoWorkCard
        video={video({ content_type: 'P', publish_date: '2026-08-17', platform_formats: null } as never)}
        index={0}
        platforms={['instagram'] as never}
        postingTime="10:00"
      />,
    )
    expect(screen.getByText(/post en instagram/i)).toBeInTheDocument()
    expect(screen.queryByText(/reel en instagram/i)).not.toBeInTheDocument()
  })
})

describe('VideoWorkCard — lo que se mira, arriba (tira de escenas + QC, una sola vez)', () => {
  it('shows the scene strip and QC dots exactly once, above the file list', () => {
    render(
      <VideoWorkCard
        video={video({
          videos: {
            raw: [],
            broll: [],
            edited: [
              { id: 'e-old', status: 'uploaded', uploaded_at: '2026-08-01T00:00:00.000Z' },
              { id: 'e-new', status: 'uploaded', uploaded_at: '2026-08-10T00:00:00.000Z' },
            ],
          },
        } as never)}
        index={0}
      />,
    )
    // Exactly one strip, for the most recently uploaded (vigente) edited cut.
    const strips = screen.getAllByTestId('scene-strip')
    expect(strips).toHaveLength(1)
    expect(strips[0]).toHaveAttribute('data-video-id', 'e-new')

    const dots = screen.getAllByTestId('qc-dots')
    expect(dots).toHaveLength(1)
    expect(dots[0]).toHaveAttribute('data-video-id', 'e-new')

    // Above the file list: the strip/dots come before the (mocked) file panel in the DOM.
    const panel = screen.getByTestId('idea-video-panel')
    expect(strips[0].compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dots[0].compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not render the scene strip (nothing to show) when there is no edited video yet', () => {
    render(<VideoWorkCard video={video()} index={0} />)
    expect(screen.queryByTestId('scene-strip')).not.toBeInTheDocument()
    // QC dots still mount (ideaId-only) — it decides on its own whether to show anything real.
    expect(screen.getByTestId('qc-dots')).toBeInTheDocument()
  })

  it('ignores a non-uploaded (e.g. archived) edited video when picking the vigente cut', () => {
    render(
      <VideoWorkCard
        video={video({
          videos: {
            raw: [],
            broll: [],
            edited: [{ id: 'e-archived', status: 'archived', uploaded_at: '2026-08-10T00:00:00.000Z' }],
          },
        } as never)}
        index={0}
      />,
    )
    expect(screen.queryByTestId('scene-strip')).not.toBeInTheDocument()
  })
})
