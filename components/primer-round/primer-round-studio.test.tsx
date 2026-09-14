import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PrimerRoundStudio } from './primer-round-studio'
import type { PrimerRoundStudioPayload } from '@/lib/actions/primer-round'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/primer-round', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/primer-round')>('@/lib/actions/primer-round')
  return {
    ...actual,
    createPrimerRoundUploadIdea: vi.fn(),
    runPrimerRoundUploadPipeline: vi.fn(),
    generatePrimerRoundCaption: vi.fn(),
    verifyPrimerRoundOrtho: vi.fn(),
    schedulePrimerRoundReel: vi.fn(),
  }
})
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregasUploadUrl: vi.fn(),
  registerEntregasVideo: vi.fn(),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn(async () => ({ analyzed: true })),
}))
vi.mock('@/lib/actions/pipeline-submit', () => ({
  reportUploadFailure: vi.fn(),
}))

const studio: PrimerRoundStudioPayload = {
  client: {
    id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d',
    name: 'Primer Round Oficial',
    logoUrl: null,
    blogId: '5476146',
    igHandle: 'primerroundoficial',
  },
  collabs: [
    { username: 'denniseyperez', label: 'Dennise Pérez' },
    { username: 'rafaellenin', label: 'Rafael Lenín López' },
  ],
  autopostEnabled: true,
  ctas: {
    ideas: '/escribir-ideas?c=x',
    bank: '/banco',
    pipeline: '/pipeline',
    editing: '/pipeline',
    review: '/revision',
    onsite: '/onsite',
    recording: '/recording-calendar',
    client: '/clients/x',
  },
  lanes: { ideas: [], bank: [], editing: [], review: [], ready: [], other: [] },
  ready: [],
}

describe('PrimerRoundStudio', () => {
  it('shows minimal Spanish chrome with Upload video CTA and collabs (no lane cards)', () => {
    render(<PrimerRoundStudio studio={studio} />)
    expect(screen.getByRole('heading', { name: /Primer Round/i })).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-panel')).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-cta')).toHaveTextContent(/Upload video/i)
    expect(screen.getByText(/mp4 o mov\. La IA lee el video/i)).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-input')).toHaveAttribute(
      'accept',
      expect.stringMatching(/\.mov/i),
    )
    expect(screen.queryByText(/^Ideas$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Banco$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/En edición/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Revisión$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Listos para publicar/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crear caption IG/i })).not.toBeInTheDocument()
  })

  it('muestra el .mov en un reproductor local al elegirlo', () => {
    const create = vi.fn(() => 'blob:mov-preview')
    const revoke = vi.fn()
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    const { unmount } = render(<PrimerRoundStudio studio={studio} />)
    fireEvent.change(screen.getByTestId('primer-round-upload-input'), {
      target: { files: [new File(['x'], 'entrevista.mov', { type: 'video/quicktime' })] },
    })
    const preview = screen.getByTestId('primer-round-video-preview')
    expect(preview.tagName).toBe('VIDEO')
    expect(preview).toHaveAttribute('src', 'blob:mov-preview')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:mov-preview')
  })
})
