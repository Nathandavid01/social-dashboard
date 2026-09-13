import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrimerRoundStudio } from './primer-round-studio'
import type { PrimerRoundStudioPayload } from '@/lib/actions/primer-round'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/primer-round', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/primer-round')>('@/lib/actions/primer-round')
  return {
    ...actual,
    generatePrimerRoundCaption: vi.fn(),
    verifyPrimerRoundOrtho: vi.fn(),
    schedulePrimerRoundReel: vi.fn(),
  }
})

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
  ready: [
    {
      id: 'idea-1',
      title: 'Entrevista del día',
      status: 'producida',
      approval_status: 'approved',
      caption: null,
      contentType: 'R',
      publishDate: '2026-09-14',
      overlayText: 'Hoy en Primer Round',
      overlayIssues: 0,
      analysisStatus: 'done',
      hasEditedVideo: true,
    },
  ],
}

describe('PrimerRoundStudio', () => {
  it('shows Spanish studio chrome, collabs, and ortho panel affordances', () => {
    // ready is also in lanes for counts
    const payload = {
      ...studio,
      lanes: { ...studio.lanes, ready: studio.ready },
    }
    render(<PrimerRoundStudio studio={payload} />)
    expect(screen.getByText(/Estudio Primer Round/i)).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
    expect(screen.getByText(/Listos para publicar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear caption IG/i })).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-ortho-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agendar Reel en Metricool/i })).toBeInTheDocument()
  })
})
