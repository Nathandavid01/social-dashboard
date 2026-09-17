import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditorStudioPage from './page'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { EDITOR_STUDIO_MAX_BYTES, EDITOR_STUDIO_UPLOAD_LIMITS } from '@/lib/estudio/upload-limit'

vi.mock('@/lib/actions/editor-studio', () => ({
  getEditorStudio: vi.fn(async () => ({
    studio: {
      clients: [
        {
          id: PRIMER_ROUND_CLIENT_ID,
          name: 'Primer Round Oficial',
          logoUrl: null,
          blogId: '5476146',
          platforms: ['instagram'],
          isPrimerRound: true,
        },
      ],
      primerRoundCollabs: [
        { username: 'denniseyperez', label: 'Dennise Pérez' },
        { username: 'rafaellenin', label: 'Rafael Lenín López' },
      ],
      maxUploadBytes: EDITOR_STUDIO_MAX_BYTES,
      uploadLimits: EDITOR_STUDIO_UPLOAD_LIMITS,
    },
  })),
  createEditorStudioIdea: vi.fn(),
  generateEditorStudioCaption: vi.fn(),
  pushEditorStudioDraft: vi.fn(),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({ registerEntregasVideo: vi.fn() }))
vi.mock('@/lib/utils/video-postupload-client', () => ({ processUploadedVideo: vi.fn() }))

describe('EditorStudioPage', () => {
  it('renders the Spanish editor studio shell', async () => {
    const ui = await EditorStudioPage()
    render(ui)
    expect(screen.getByRole('heading', { name: /^Estudio$/i })).toBeInTheDocument()
    expect(screen.getByTestId('estudio-upload-cta')).toBeInTheDocument()
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
  })
})
