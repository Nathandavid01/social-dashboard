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
    },
  })),
  generatePrimerRoundCaption: vi.fn(),
  verifyPrimerRoundOrtho: vi.fn(),
  schedulePrimerRoundReel: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('PrimerRoundPage', () => {
  it('renders the Spanish studio shell', async () => {
    const ui = await PrimerRoundPage()
    render(ui)
    expect(screen.getByText(/Estudio Primer Round/i)).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
  })
})
