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
vi.mock('@/components/recording/idea-video-panel', () => ({ IdeaVideoPanel: () => null }))
vi.mock('@/components/shared/inline-edit', () => ({
  InlineEdit: ({ value }: { value?: string | null }) => <span>{value}</span>,
}))
vi.mock('@/lib/actions/content-ideas', () => ({ updateIdeaTitle: vi.fn() }))

vi.mock('@/lib/actions/idea-approval', () => ({
  submitIdeaForApproval: vi.fn(async () => ({ ok: true as const })),
  approveIdea: vi.fn(async () => ({ ok: true as const })),
  requestRevision: vi.fn(async () => ({ ok: true as const })),
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
    expect(screen.getByText(/aprobado/i)).toBeInTheDocument()
  })

  it('explains the lack of permission for non-approvers', () => {
    mockRole = 'video'
    render(<VideoWorkCard video={video({ approval_status: 'submitted' })} index={0} />)
    expect(screen.getByText(/sin permiso para aprobar/i)).toBeInTheDocument()
  })
})
