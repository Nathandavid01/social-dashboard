import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrimerRoundPage from './page'

vi.mock('@/lib/actions/primer-round', () => ({
  getPrimerRoundStudio: vi.fn(async () => ({
    studio: {
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
      pending: null,
      styleRules: [],
    },
  })),
  createPrimerRoundUploadIdea: vi.fn(),
  runPrimerRoundUploadPipeline: vi.fn(),
  generatePrimerRoundCaption: vi.fn(),
  verifyPrimerRoundOrtho: vi.fn(),
  schedulePrimerRoundReel: vi.fn(),
  revisePrimerRoundCaption: vi.fn(),
  acceptPrimerRoundPiece: vi.fn(),
  pushPrimerRoundDraft: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/entregas-r2', () => ({
  registerEntregasVideo: vi.fn(),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn(),
}))
vi.mock('@/lib/actions/pipeline-submit', () => ({
  reportUploadFailure: vi.fn(),
}))

describe('PrimerRoundPage', () => {
  it('renders the Spanish upload shell', async () => {
    const ui = await PrimerRoundPage()
    render(ui)
    expect(screen.getByRole('heading', { name: /Primer Round/i })).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-cta')).toBeInTheDocument()
  })
})
