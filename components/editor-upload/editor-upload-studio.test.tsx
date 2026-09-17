import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorUploadStudio } from './editor-upload-studio'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { EDITOR_UPLOAD_MAX_BYTES } from '@/lib/editor-upload/limits'
import {
  createEditorUploadIdea,
  runEditorUploadPipeline,
  pushEditorUploadDraft,
  reviseEditorUploadCaption,
  saveEditorUploadCaption,
} from '@/lib/actions/editor-upload'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import type { EditorUploadStudioPayload } from '@/lib/actions/editor-upload'

vi.mock('@/lib/actions/editor-upload', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/editor-upload')>(
    '@/lib/actions/editor-upload',
  )
  return {
    ...actual,
    createEditorUploadIdea: vi.fn(),
    runEditorUploadPipeline: vi.fn(),
    pushEditorUploadDraft: vi.fn(),
    reviseEditorUploadCaption: vi.fn(),
    saveEditorUploadCaption: vi.fn(),
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

const studio: EditorUploadStudioPayload = {
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
      name: 'Otro Cliente',
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
  maxBytes: EDITOR_UPLOAD_MAX_BYTES,
}

function videoFile(name: string, size = 12) {
  return new File([new Uint8Array(size)], name, { type: 'video/mp4' })
}

describe('EditorUploadStudio', () => {
  beforeEach(() => {
    vi.mocked(createEditorUploadIdea).mockResolvedValue({ ideaId: 'idea-1', title: 'clip' })
    vi.mocked(uploadEntregasFileFast).mockResolvedValue({ key: 'entregas/idea-1/edited/clip.mp4' })
    vi.mocked(registerEntregasVideo).mockResolvedValue({ ok: true, id: 'video-1' })
    vi.mocked(processUploadedVideo).mockResolvedValue({ analyzed: true })
    vi.mocked(runEditorUploadPipeline).mockResolvedValue({
      ok: true,
      caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.\n\n#magic973 #puertorico #primerround',
      pieceKind: 'live',
    })
    vi.mocked(saveEditorUploadCaption).mockImplementation(async ({ caption }) => ({ caption }))
    vi.mocked(pushEditorUploadDraft).mockResolvedValue({ ok: true, metricoolPostId: 88 })
    vi.mocked(reviseEditorUploadCaption).mockResolvedValue({ caption: 'Caption nuevo', pieceKind: 'live' })
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el flujo en español: cliente, 500 MB, collabs y borrador (no publicar)', () => {
    render(<EditorUploadStudio studio={studio} />)
    expect(screen.getByRole('heading', { level: 1, name: /Subir video/i })).toBeInTheDocument()
    expect(screen.getByTestId('editor-upload-cta')).toHaveTextContent(/Upload video/i)
    expect(screen.getAllByText(/500 MB/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/borrador/i).length).toBeGreaterThan(0)
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
    expect(screen.getByTestId('editor-upload-collabs')).toBeChecked()
    expect(screen.queryByText(/Publicar en Instagram/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('editor-upload-input')).toHaveAttribute(
      'accept',
      expect.stringMatching(/\.mov/i),
    )
  })

  it('rechaza un archivo de más de 500 MB antes de subir', async () => {
    render(<EditorUploadStudio studio={studio} />)
    const huge = videoFile('huge.mov')
    Object.defineProperty(huge, 'size', { value: EDITOR_UPLOAD_MAX_BYTES + 1 })
    fireEvent.change(screen.getByTestId('editor-upload-input'), { target: { files: [huge] } })
    await waitFor(() => expect(screen.getByTestId('editor-upload-status')).toHaveTextContent(/500 MB/i))
    expect(createEditorUploadIdea).not.toHaveBeenCalled()
  })

  it('sube, analiza, arma caption y envía borrador a Metricool', async () => {
    render(<EditorUploadStudio studio={studio} />)
    fireEvent.change(screen.getByTestId('editor-upload-input'), {
      target: { files: [videoFile('clip.mp4', 64)] },
    })
    await waitFor(() => expect(screen.getByTestId('editor-upload-caption')).toBeInTheDocument())
    expect(createEditorUploadIdea).toHaveBeenCalled()
    expect(uploadEntregasFileFast).toHaveBeenCalled()
    expect(processUploadedVideo).toHaveBeenCalled()
    expect(runEditorUploadPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ ideaId: 'idea-1', videoId: 'video-1' }),
    )
    expect(screen.getByTestId('editor-upload-draft-cta')).toHaveTextContent(/borrador/i)
    await act(async () => fireEvent.click(screen.getByTestId('editor-upload-draft-cta')))
    await waitFor(() => expect(pushEditorUploadDraft).toHaveBeenCalled())
    expect(pushEditorUploadDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        ideaId: 'idea-1',
        videoId: 'video-1',
        includeCollabs: true,
      }),
    )
    expect(screen.getByTestId('editor-upload-status')).toHaveTextContent(/No está en vivo/i)
  })

  it('en otro cliente las collabs salen apagadas', () => {
    render(<EditorUploadStudio studio={studio} />)
    fireEvent.change(screen.getByTestId('editor-upload-client'), {
      target: { value: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    })
    expect(screen.getByTestId('editor-upload-collabs')).not.toBeChecked()
  })
})
