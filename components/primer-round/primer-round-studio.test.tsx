import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrimerRoundStudio } from './primer-round-studio'
import { clearPrimerRoundLivePreview } from '@/lib/primer-round/live-preview'
import { createPrimerRoundUploadIdea, runPrimerRoundUploadPipeline, acceptPrimerRoundPiece, revisePrimerRoundCaption } from '@/lib/actions/primer-round'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
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
    revisePrimerRoundCaption: vi.fn(),
    acceptPrimerRoundPiece: vi.fn(),
  }
})
vi.mock('@/lib/actions/entregas-r2', () => ({
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
  pending: null,
  styleRules: [],
}

describe('PrimerRoundStudio', () => {
  beforeEach(() => {
    clearPrimerRoundLivePreview()
  })

  it('shows minimal Spanish chrome with Upload video CTA and collabs (no lane cards)', () => {
    render(<PrimerRoundStudio studio={studio} />)
    expect(screen.getByRole('heading', { name: /Primer Round/i })).toBeInTheDocument()
    expect(screen.getByText('@denniseyperez')).toBeInTheDocument()
    expect(screen.getByText('@rafaellenin')).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-panel')).toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-cta')).toHaveTextContent(/Upload video/i)
    expect(screen.getByText(/mp4 o mov\. La IA lee el video/i)).toBeInTheDocument()
    expect(screen.getByText(/Al aire lun–vie 5:43 AM/i)).toBeInTheDocument()
    expect(screen.getByText(/Si publicas ahora:/i)).toBeInTheDocument()
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
    const { unmount: unmountAgain } = render(<PrimerRoundStudio studio={studio} />)
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:mov-preview')
    unmountAgain()
    expect(revoke).not.toHaveBeenCalledWith('blob:mov-preview')
  })

  it('keeps the newly selected video when an older pending piece exists', async () => {
    let finishCreation!: (result: { error: string }) => void
    vi.mocked(createPrimerRoundUploadIdea).mockReturnValueOnce(new Promise((resolve) => {
      finishCreation = resolve
    }))
    URL.createObjectURL = vi.fn(() => 'blob:new-video')
    URL.revokeObjectURL = vi.fn()
    const pendingStudio = {
      ...studio,
      pending: {
        ideaId: 'old-idea', videoId: 'old-video', fileName: 'old.mp4',
        previewUrl: 'https://r2.example/old.mp4', caption: 'Old caption',
        overlayText: 'Old overlay', visualSummary: null,
      },
    }
    const { rerender } = render(<PrimerRoundStudio studio={pendingStudio} />)
    fireEvent.change(screen.getByTestId('primer-round-upload-input'), {
      target: { files: [new File(['new'], 'new.mp4', { type: 'video/mp4' })] },
    })
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:new-video')
    expect(screen.getByTestId('primer-round-pipeline-status')).toHaveTextContent('new.mp4')
    expect(screen.queryByTestId('primer-round-caption-panel')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:new-video')
    rerender(<PrimerRoundStudio studio={{ ...pendingStudio, pending: { ...pendingStudio.pending } }} />)
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:new-video')
    await act(async () => finishCreation({ error: 'Upload failed' }))
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:new-video')
    expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
  })

  it('al entrar no muestra el video ni el caption de una pieza anterior', () => {
    render(
      <PrimerRoundStudio
        studio={{
          ...studio,
          pending: {
            ideaId: 'idea-1',
            videoId: 'vid-1',
            fileName: 'Primer_Round_Reel_GFX_H264.mov',
            previewUrl: 'https://r2.example/signed.mov',
            caption:
              '¿Quién responde?\n\nMañana desde las 5:43 AM junto a @rafaellenin y @denniseyperez.\n\n#magic973 #puertorico #primerround',
            overlayText: 'LA NOTICIA NO ESPERA',
            visualSummary: 'Estudio de radio',
          },
          styleRules: ['El gancho es LA NOTICIA NO ESPERA, no las tres preguntas'],
        }}
      />,
    )
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-caption-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-feedback')).not.toBeInTheDocument()
    expect(screen.getByTestId('primer-round-upload-cta')).toBeInTheDocument()
  })
})

// Exercise the actual upload handler with controlled network/server boundaries.
describe('PrimerRoundStudio upload lifecycle', () => {
  let requests: UploadRequest[]
  class UploadRequest {
    upload = { onprogress: null as null | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) }
    status = 200
    responseText = '{"key":"new-key"}'
    onload = () => {}
    onerror = () => {}
    ontimeout = () => {}
    onabort = () => {}
    open = vi.fn()
    setRequestHeader = vi.fn()
    send = vi.fn(() => requests.push(this))
    abort = vi.fn(() => {
      this.onabort()
    })
  }
  const oldPending = {
    ideaId: 'old-idea', videoId: 'old-video', fileName: 'old.mp4',
    previewUrl: 'https://r2.example/old.mp4', caption: 'Old caption',
    overlayText: 'Old overlay', visualSummary: null,
  }
  beforeEach(() => {
    clearPrimerRoundLivePreview()
    vi.clearAllMocks()
    requests = []
    vi.stubGlobal('XMLHttpRequest', UploadRequest)
    URL.createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:first-new-video')
      .mockReturnValueOnce('blob:second-new-video')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(createPrimerRoundUploadIdea).mockResolvedValue({ ideaId: 'new-idea' })
    vi.mocked(registerEntregasVideo).mockResolvedValue({ id: 'new-video' })
    vi.mocked(processUploadedVideo).mockResolvedValue({ analyzed: true })
    vi.mocked(runPrimerRoundUploadPipeline).mockResolvedValue({ pending: true, caption: 'Nuevo contenido' })
    vi.mocked(revisePrimerRoundCaption).mockResolvedValue({ caption: 'Caption con feedback' })
  })
  afterEach(() => vi.unstubAllGlobals())

  async function pick(name = 'new.mp4') {
    const file = new File(['new-video-content'], name, { type: name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4' })
    fireEvent.change(screen.getByTestId('primer-round-upload-input'), { target: { files: [file] } })
    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    return file
  }

  it.each(['new.mp4', 'new.mov'])('completes %s and retains the new preview through stale refreshes', async (name) => {
    const { rerender } = render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    const file = await pick(name)
    const player = screen.getByTestId('primer-round-video-preview')
    expect(player).toHaveAttribute('src', 'blob:first-new-video')
    expect(screen.getByTestId('primer-round-upload-cta')).toBeDisabled()
    expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
    expect(screen.queryByText('Old overlay')).not.toBeInTheDocument()
    expect(requests[0].send).toHaveBeenCalledWith(file)
    act(() => requests[0].upload.onprogress?.({ lengthComputable: true, loaded: 7, total: 10 }))
    expect(screen.getByTestId('primer-round-pipeline-status').querySelector('[style]')).toHaveStyle({ width: '70%' })
    await act(async () => requests[0].onload())
    await waitFor(() => expect(screen.getByTestId('primer-round-accept-cta')).toBeEnabled())
    expect(registerEntregasVideo).toHaveBeenCalledWith(expect.objectContaining({ ideaId: 'new-idea', key: 'new-key', name }))
    expect(processUploadedVideo).toHaveBeenCalledWith('new-video', file)
    expect(runPrimerRoundUploadPipeline).toHaveBeenCalledWith({ ideaId: 'new-idea', videoId: 'new-video' })
    expect(screen.getByTestId('primer-round-caption-panel')).toHaveTextContent('Nuevo contenido')
    rerender(<PrimerRoundStudio studio={{ ...studio, pending: { ...oldPending } }} />)
    expect(screen.getByTestId('primer-round-video-preview')).toBe(player)
    expect(player).toHaveAttribute('src', 'blob:first-new-video')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:first-new-video')
    expect(acceptPrimerRoundPiece).not.toHaveBeenCalled()
    vi.mocked(acceptPrimerRoundPiece).mockResolvedValueOnce({ error: 'QA: publication stopped' })
    await act(async () => fireEvent.click(screen.getByTestId('primer-round-accept-cta')))
    expect(acceptPrimerRoundPiece).toHaveBeenCalledWith({ ideaId: 'new-idea', videoId: 'new-video', overrideOrtho: false })
  })

  it.each(['http', 'network', 'timeout', 'missing-key', 'register', 'analysis', 'caption'] as const)(
    'keeps the new video and blocks acceptance after %s failure', async (failure) => {
      if (failure === 'register') vi.mocked(registerEntregasVideo).mockResolvedValue({ error: 'Register failed' })
      if (failure === 'analysis') vi.mocked(processUploadedVideo).mockResolvedValue({ analyzed: false })
      if (failure === 'caption') vi.mocked(runPrimerRoundUploadPipeline).mockResolvedValue({ error: 'Caption failed' })
      render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
      await pick()
      await act(async () => {
        if (failure === 'http') requests[0].status = 500
        if (failure === 'missing-key') requests[0].responseText = '{}'
        if (failure === 'network') requests[0].onerror()
        else if (failure === 'timeout') requests[0].ontimeout()
        else requests[0].onload()
      })
      await waitFor(() => expect(screen.getByTestId('primer-round-pipeline-status')).toHaveTextContent('Error'))
      expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:first-new-video')
      expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
      expect(screen.getByTestId('primer-round-upload-cta')).toBeEnabled()
      expect(acceptPrimerRoundPiece).not.toHaveBeenCalled()
    },
  )

  it('allows selecting the same filename again and releases only replaced object URLs', async () => {
    const { unmount } = render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    await pick()
    await act(async () => requests[0].onload())
    await waitFor(() => expect(screen.getByTestId('primer-round-upload-cta')).toBeEnabled())
    await pick()
    expect(screen.getByTestId('primer-round-upload-input')).toHaveValue('')
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:second-new-video')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-new-video')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:second-new-video')
    await act(async () => requests[1].onload())
    unmount()
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:second-new-video')
  })

  it('click Upload wipes the previous caption and video before the next file', async () => {
    render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    await pick()
    await act(async () => requests[0].onload())
    await waitFor(() => expect(screen.getByTestId('primer-round-caption-panel')).toHaveTextContent('Nuevo contenido'))
    fireEvent.click(screen.getByTestId('primer-round-upload-cta'))
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-caption-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
    expect(createPrimerRoundUploadIdea).toHaveBeenCalledTimes(1)
  })

  it('Detener a mitad de la subida aborta el PUT y deja la página vacía', async () => {
    render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    expect(screen.queryByTestId('primer-round-stop-cta')).not.toBeInTheDocument()
    await pick()
    expect(screen.getByTestId('primer-round-stop-cta')).toBeEnabled()
    expect(screen.getByTestId('primer-round-video-preview')).toHaveAttribute('src', 'blob:first-new-video')
    await act(async () => fireEvent.click(screen.getByTestId('primer-round-stop-cta')))
    expect(requests[0].abort).toHaveBeenCalled()
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-caption-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-accept-cta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primer-round-stop-cta')).not.toBeInTheDocument()
    expect(registerEntregasVideo).not.toHaveBeenCalled()
    expect(runPrimerRoundUploadPipeline).not.toHaveBeenCalled()
    expect(acceptPrimerRoundPiece).not.toHaveBeenCalled()
    await act(async () => requests[0].onload())
    expect(registerEntregasVideo).not.toHaveBeenCalled()
    expect(runPrimerRoundUploadPipeline).not.toHaveBeenCalled()
    expect(screen.queryByText(/Old overlay|Old caption/i)).not.toBeInTheDocument()
  })

  it('feedback y accept clavan el video nuevo, nunca el leftover', async () => {
    render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    await pick()
    await act(async () => requests[0].onload())
    await waitFor(() => expect(screen.getByTestId('primer-round-accept-cta')).toBeEnabled())
    fireEvent.change(screen.getByTestId('primer-round-feedback'), { target: { value: 'Más corto' } })
    await act(async () => fireEvent.click(screen.getByTestId('primer-round-feedback-cta')))
    expect(revisePrimerRoundCaption).toHaveBeenCalledWith({
      ideaId: 'new-idea',
      videoId: 'new-video',
      feedback: 'Más corto',
      previousCaption: 'Nuevo contenido',
    })
    expect(revisePrimerRoundCaption).not.toHaveBeenCalledWith(
      expect.objectContaining({ ideaId: 'old-idea', videoId: 'old-video' }),
    )
  })

  it('leaves the landing empty when file selection is cancelled or invalid', () => {
    render(<PrimerRoundStudio studio={{ ...studio, pending: oldPending }} />)
    const input = screen.getByTestId('primer-round-upload-input')
    fireEvent.change(input, { target: { files: [] } })
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] } })
    expect(screen.queryByTestId('primer-round-video-preview')).not.toBeInTheDocument()
    expect(createPrimerRoundUploadIdea).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
