import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { OnsiteSession } from '@/lib/actions/onsite'

const refresh = vi.fn()
const toast = vi.fn()
const startUpload = vi.fn(() => 'up-1')
const findDuplicateVideo = vi.fn(async (): Promise<import('@/lib/actions/video-dedupe').DuplicateVideo | null> => null)
const createRecordingSession = vi.fn(async (_values?: unknown): Promise<{ id?: string; error?: string }> => ({ id: 's-new' }))
const createContentIdeaManual = vi.fn(async (_input?: unknown): Promise<{ idea?: { id: string }; error?: string }> => ({ idea: { id: 'idea-new' } }))
const addIdeaToSession = vi.fn(async (_input?: unknown): Promise<{ ok?: true; error?: string }> => ({ ok: true }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const storeUploads: Record<string, { id: string; fileName: string; ideaId: string; phase: string }> = {}
vi.mock('@/lib/stores/upload-store', () => ({
  useUploadStore: (sel: (s: { startUpload: typeof startUpload; uploads: typeof storeUploads }) => unknown) =>
    sel({ startUpload, uploads: storeUploads }),
}))
const getOnsiteUploadContext = vi.fn(async (_id?: string) => ({ context: undefined }))
vi.mock('@/lib/actions/onsite-upload-context', () => ({
  getOnsiteUploadContext: (id: string) => getOnsiteUploadContext(id),
}))
vi.mock('@/lib/actions/video-dedupe', () => ({
  findDuplicateVideo: () => findDuplicateVideo(),
  rememberVideoFingerprint: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/utils/video-fingerprint', () => ({
  fingerprintFile: async () => 'v1-1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
}))
vi.mock('@/lib/actions/recording-sessions', () => ({
  createRecordingSession: (values: unknown) => createRecordingSession(values),
}))
vi.mock('@/lib/actions/content-ideas', () => ({
  createContentIdeaManual: (input: unknown) => createContentIdeaManual(input),
}))
vi.mock('@/lib/actions/onsite', () => ({
  addIdeaToSession: (input: unknown) => addIdeaToSession(input),
}))

import { SubirCrudoPanel } from './subir-crudo-panel'

const session = (over: Partial<OnsiteSession> = {}): OnsiteSession => ({
  id: 's1',
  title: 'Blue Chiropractic',
  date: '2026-09-19',
  clientId: 'c1',
  clientName: 'Blue Chiropractic',
  location: null,
  status: 'scheduled',
  perWeek: 3,
  perMonth: 13,
  slotTarget: 20,
  arrivedAt: null,
  arrivedById: null,
  arrivedByName: null,
  ...over,
})

const clients = [
  { id: 'c1', name: 'Blue Chiropractic' },
  { id: 'c2', name: 'El Truco de Guin' },
]

function renderPanel(over: Partial<ComponentProps<typeof SubirCrudoPanel>> = {}) {
  return render(
    <SubirCrudoPanel
      clients={clients}
      sessions={[session()]}
      today="2026-09-19"
      canUpload
      canCreateSession
      {...over}
    />,
  )
}

function pickFile(name = 'IMG_8841.MOV', type = 'video/quicktime') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['data'], name, { type })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
  return file
}

beforeEach(() => {
  cleanup()
  refresh.mockClear()
  toast.mockClear()
  startUpload.mockClear()
  findDuplicateVideo.mockReset().mockResolvedValue(null)
  createRecordingSession.mockReset().mockResolvedValue({ id: 's-new' })
  createContentIdeaManual.mockReset().mockResolvedValue({ idea: { id: 'idea-new' } })
  addIdeaToSession.mockReset().mockResolvedValue({ ok: true })
  getOnsiteUploadContext.mockReset().mockResolvedValue({ context: undefined })
  for (const key of Object.keys(storeUploads)) delete storeUploads[key]
})

describe('SubirCrudoPanel', () => {
  it('la puerta principal es Subir crudo, sin pestañas de editado ni b-roll', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Subir crudo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /editado/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /b-roll/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/llegué/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/call sheet/i)).not.toBeInTheDocument()
  })

  it('sin cliente y sin video no deja subir', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'c1' } })
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeDisabled()
    pickFile()
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeEnabled()
  })

  it('obliga a elegir cliente: no hereda el de la sesión de hoy', () => {
    renderPanel()
    expect(screen.getByLabelText('Cliente')).toHaveValue('')
    pickFile()
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeDisabled()
    expect(createRecordingSession).not.toHaveBeenCalled()
  })

  it('sin cliente no crea sesión aunque haya videos', () => {
    renderPanel({ sessions: [] })
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    expect(createRecordingSession).not.toHaveBeenCalled()
    expect(startUpload).not.toHaveBeenCalled()
  })

  it('elige la sesión de hoy sola y sube como crudo a esa toma', async () => {
    const file = (() => {
      renderPanel({ defaultClientId: 'c1', defaultSessionId: 's1', existingIdeaId: 'i1' })
      return pickFile()
    })()
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        ideaId: 'i1',
        kind: 'raw',
        provider: 'r2',
      })),
    )
    expect(createRecordingSession).not.toHaveBeenCalled()
    expect(createContentIdeaManual).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/Pipeline/i)
    expect(screen.getByRole('link', { name: /Pipeline/i })).toHaveAttribute(
      'href',
      '/pipeline?lote=c1&idea=i1&sesion=s1',
    )
  })

  it('si no hay sesión de hoy, la crea con la API existente y pega el crudo', async () => {
    renderPanel({ sessions: [] })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'c1' } })
    const file = pickFile('Toma patio.mp4', 'video/mp4')
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    await waitFor(() =>
      expect(createRecordingSession).toHaveBeenCalledWith({
        session_date: '2026-09-19',
        client_id: 'c1',
        title: 'Blue Chiropractic',
      }),
    )
    await waitFor(() =>
      expect(createContentIdeaManual).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'c1',
        contentType: 'R',
        title: 'Toma patio',
      })),
    )
    await waitFor(() =>
      expect(addIdeaToSession).toHaveBeenCalledWith({
        sessionId: 's-new',
        ideaId: 'idea-new',
        source: 'pipeline',
      }),
    )
    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        ideaId: 'idea-new',
        kind: 'raw',
        provider: 'r2',
      })),
    )
    expect(screen.getByRole('link', { name: /Pipeline/i })).toHaveAttribute(
      'href',
      '/pipeline?lote=c1&idea=idea-new&sesion=s-new',
    )
  })

  it('rechaza un archivo que no es video', () => {
    renderPanel({ defaultClientId: 'c1' })
    pickFile('notas.html', 'text/html')
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    expect(screen.getByText(/solo se aceptan videos/i)).toBeInTheDocument()
    expect(startUpload).not.toHaveBeenCalled()
  })

  it('si falla crear la sesión, no empieza a subir', async () => {
    createRecordingSession.mockResolvedValueOnce({ error: 'No autorizado' })
    renderPanel({ sessions: [] })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'c1' } })
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(startUpload).not.toHaveBeenCalled()
  })

  it('con varias sesiones de hoy, obliga a elegir y no crea otra', async () => {
    renderPanel({
      sessions: [
        session({ id: 's-a', title: 'Mañana', location: 'Arecibo' }),
        session({ id: 's-b', title: 'Tarde', location: 'Hatillo' }),
      ],
      defaultClientId: 'c1',
    })
    pickFile()
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Sesión de hoy'), { target: { value: 's-b' } })
    expect(screen.getByRole('button', { name: 'Subir crudo' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    await waitFor(() => expect(startUpload).toHaveBeenCalled())
    expect(createRecordingSession).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Pipeline/i })).toHaveAttribute(
      'href',
      '/pipeline?lote=c1&idea=idea-new&sesion=s-b',
    )
  })

  it('sin permiso de subida no se muestra', () => {
    renderPanel({ canUpload: false })
    expect(screen.queryByRole('heading', { name: 'Subir crudo' })).not.toBeInTheDocument()
  })

  it('muestra para quién se sube, qué idea falta y lo ya subido', () => {
    renderPanel({
      defaultClientId: 'c1',
      defaultSessionId: 's1',
      uploadContext: {
        sessionId: 's1',
        clientName: 'Blue Chiropractic',
        sessionTitle: 'Mañana Arecibo',
        sessionDate: '2026-09-19',
        ideas: [
          { ideaId: 'i1', title: 'Intro Patricia', rawCount: 1 },
          { ideaId: 'i2', title: 'Tour de sala', rawCount: 0 },
        ],
        uploads: [
          { videoId: 'v1', name: 'IMG_8841.MOV', status: 'uploaded', ideaId: 'i1', ideaTitle: 'Intro Patricia' },
        ],
      },
    })
    expect(screen.getByTestId('upload-target-context')).toHaveTextContent('Blue Chiropractic · Mañana Arecibo · 2 ideas')
    expect(screen.getByText('Intro Patricia')).toBeInTheDocument()
    expect(screen.getByText('Ya hay crudo')).toBeInTheDocument()
    expect(screen.getByText('Tour de sala')).toBeInTheDocument()
    expect(screen.getByText('Falta crudo')).toBeInTheDocument()
    expect(screen.getByText('IMG_8841.MOV')).toBeInTheDocument()
    expect(screen.getByText(/Subido · Intro Patricia/)).toBeInTheDocument()
  })

  it('lista también una subida en vuelo de esta sesión', () => {
    storeUploads['up-2'] = { id: 'up-2', fileName: 'nuevo.MOV', ideaId: 'i1', phase: 'subiendo' }
    renderPanel({
      defaultClientId: 'c1',
      defaultSessionId: 's1',
      uploadContext: {
        sessionId: 's1',
        clientName: 'Blue Chiropractic',
        sessionTitle: 'Mañana',
        sessionDate: '2026-09-19',
        ideas: [{ ideaId: 'i1', title: 'Intro Patricia', rawCount: 0 }],
        uploads: [],
      },
    })
    expect(screen.getByText('nuevo.MOV')).toBeInTheDocument()
    expect(screen.getByText(/Subiendo · Intro Patricia/)).toBeInTheDocument()
  })

  it('si el archivo ya estaba, no crea sesión ni idea vacía', async () => {
    findDuplicateVideo.mockResolvedValueOnce({
      videoId: 'vid-9',
      kind: 'raw',
      fileName: 'IMG_8841.MOV',
      uploadedAt: '2026-08-28T15:00:00Z',
      ideaId: 'idea-9',
      ideaTitle: 'Intro clínica',
      clientName: 'ARASIBO',
      uploadedBy: 'Carlos',
    })
    renderPanel({ sessions: [] })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'c1' } })
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: 'Subir crudo' }))
    await waitFor(() => expect(screen.getByText(/No se subió/)).toBeInTheDocument())
    expect(createRecordingSession).not.toHaveBeenCalled()
    expect(createContentIdeaManual).not.toHaveBeenCalled()
    expect(startUpload).not.toHaveBeenCalled()
  })
})
