import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorStudio } from './editor-studio'
import { createEditorStudioIdea, generateEditorStudioCaption, pushEditorStudioDraft } from '@/lib/actions/editor-studio'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import type { EditorStudioPayload } from '@/lib/actions/editor-studio'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { EDITOR_STUDIO_MAX_BYTES, EDITOR_STUDIO_UPLOAD_LIMITS } from '@/lib/estudio/upload-limit'

vi.mock('@/lib/actions/editor-studio', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/editor-studio')>(
    '@/lib/actions/editor-studio',
  )
  return {
    ...actual,
    createEditorStudioIdea: vi.fn(),
    generateEditorStudioCaption: vi.fn(),
    pushEditorStudioDraft: vi.fn(),
  }
})
vi.mock('@/lib/actions/entregas-r2', () => ({
  registerEntregasVideo: vi.fn(),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn(async () => ({ analyzed: true })),
}))
vi.mock('@/lib/utils/entregas-fast-upload', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/entregas-fast-upload')>(
    '@/lib/utils/entregas-fast-upload',
  )
  return { ...actual, uploadEntregasFileFast: vi.fn() }
})

const studio: EditorStudioPayload = {
  clients: [
    {
      id: PRIMER_ROUND_CLIENT_ID,
      name: 'Primer Round Oficial',
      logoUrl: null,
      blogId: '5476146',
      platforms: ['instagram', 'facebook', 'tiktok'],
      isPrimerRound: true,
    },
    {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Gym X',
      logoUrl: null,
      blogId: '1',
      platforms: ['instagram'],
      isPrimerRound: false,
    },
  ],
  primerRoundCollabs: [
    { username: 'denniseyperez', label: 'Dennise Pérez' },
    { username: 'rafaellenin', label: 'Rafael Lenín López' },
  ],
  maxUploadBytes: EDITOR_STUDIO_MAX_BYTES,
  uploadLimits: EDITOR_STUDIO_UPLOAD_LIMITS,
}

function pickFile(name = 'clip.mp4', size = 12 * 1024 * 1024) {
  const file = new File(['video-bytes'], name, { type: 'video/mp4' })
  Object.defineProperty(file, 'size', { value: size })
  fireEvent.change(screen.getByTestId('estudio-upload-input'), { target: { files: [file] } })
  return file
}

describe('EditorStudio', () => {
  beforeEach(() => {
    vi.mocked(createEditorStudioIdea).mockResolvedValue({ ideaId: 'idea-1', title: 'clip' })
    vi.mocked(uploadEntregasFileFast).mockResolvedValue({ key: 'entregas/idea-1/edited/1.mp4' })
    vi.mocked(registerEntregasVideo).mockResolvedValue({ ok: true, id: 'vid-1' })
    vi.mocked(processUploadedVideo).mockResolvedValue({ analyzed: true })
    vi.mocked(generateEditorStudioCaption).mockResolvedValue({
      caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.\n\n#magic973 #puertorico #primerround',
      visualSummary: 'Estudio de radio',
    })
    vi.mocked(pushEditorStudioDraft).mockResolvedValue({ ok: true, metricoolPostId: 88 })
    URL.createObjectURL = vi.fn(() => 'blob:preview') as unknown as typeof URL.createObjectURL
  })

  it('shows the Spanish upload shell, 500 MB cap, and Primer Round collabs', () => {
    render(<EditorStudio studio={studio} />)
    expect(screen.getByRole('heading', { name: /^Estudio$/i })).toBeInTheDocument()
    expect(screen.getByTestId('estudio-upload-cta')).toHaveTextContent(/Subir video/i)
    expect(screen.getByText(/máx\. 500 MB/i)).toBeInTheDocument()
    expect(screen.getByText(/no pasa por Vercel/i)).toBeInTheDocument()
    expect(screen.getByTestId('estudio-collab-rafaellenin')).toBeChecked()
    expect(screen.getByTestId('estudio-collab-denniseyperez')).toBeChecked()
    expect(screen.getByTestId('estudio-piece-kind')).toHaveTextContent(/Clip en vivo/i)
    expect(screen.queryByTestId('estudio-draft-cta')).not.toBeInTheDocument()
  })

  it('rejects files over 500 MB before uploading', async () => {
    render(<EditorStudio studio={studio} />)
    pickFile('huge.mp4', EDITOR_STUDIO_MAX_BYTES + 1)
    await waitFor(() => expect(screen.getByTestId('estudio-pipeline-status')).toHaveTextContent(/500 MB/))
    expect(createEditorStudioIdea).not.toHaveBeenCalled()
  })

  it('runs upload → analyze → caption, then pushes a Metricool draft (not live)', async () => {
    render(<EditorStudio studio={studio} />)
    fireEvent.click(screen.getByLabelText(/Clip en vivo/i))
    pickFile('vivo.mp4')

    await waitFor(() => expect(screen.getByTestId('estudio-draft-cta')).toBeEnabled())
    expect(generateEditorStudioCaption).toHaveBeenCalledWith(
      expect.objectContaining({ ideaId: 'idea-1', videoId: 'vid-1', pieceKind: 'live' }),
    )
    expect(screen.getByTestId('estudio-caption-panel')).toHaveTextContent(/Hoy en Primer Round/)
    expect(screen.getByTestId('estudio-analysis')).toHaveTextContent(/Estudio de radio/)

    await act(async () => fireEvent.click(screen.getByTestId('estudio-draft-cta')))
    await waitFor(() => expect(pushEditorStudioDraft).toHaveBeenCalled())
    expect(pushEditorStudioDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        ideaId: 'idea-1',
        videoId: 'vid-1',
        includeCollabs: true,
        collabUsernames: expect.arrayContaining(['rafaellenin', 'denniseyperez']),
      }),
    )
    expect(screen.getByTestId('estudio-draft-ok')).toHaveTextContent(/no se publicó/i)
  })

  it('hides Primer Round collabs for other clients', () => {
    render(<EditorStudio studio={studio} />)
    fireEvent.change(screen.getByTestId('estudio-client'), {
      target: { value: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    })
    expect(screen.queryByTestId('estudio-piece-kind')).not.toBeInTheDocument()
    expect(screen.getByTestId('estudio-extra-collabs')).toBeInTheDocument()
  })
})
