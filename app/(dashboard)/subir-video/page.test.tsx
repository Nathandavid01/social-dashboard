import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubirVideoPage from './page'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { EDITOR_UPLOAD_MAX_BYTES } from '@/lib/editor-upload/limits'

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
}))
vi.mock('@/lib/actions/editor-upload', () => ({
  getEditorUploadStudio: vi.fn(async () => ({
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
      maxBytes: EDITOR_UPLOAD_MAX_BYTES,
    },
  })),
  createEditorUploadIdea: vi.fn(),
  runEditorUploadPipeline: vi.fn(),
  pushEditorUploadDraft: vi.fn(),
  reviseEditorUploadCaption: vi.fn(),
  saveEditorUploadCaption: vi.fn(),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({ registerEntregasVideo: vi.fn() }))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn(),
}))
vi.mock('@/lib/utils/entregas-fast-upload', () => ({
  uploadEntregasFileFast: vi.fn(),
  isUploadAbortError: () => false,
}))

describe('SubirVideoPage', () => {
  it('renders the Spanish editor upload shell', async () => {
    const ui = await SubirVideoPage()
    render(ui)
    expect(screen.getByRole('heading', { level: 1, name: /Subir video/i })).toBeInTheDocument()
    expect(screen.getByTestId('editor-upload-cta')).toBeInTheDocument()
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
  })
})
