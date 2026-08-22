import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

/**
 * IdeaVideoPanel keeps uploads compact: existing files stay visible, each group
 * has a compact "+" trigger (no big dropzone box) that still accepts a drop on
 * the group, and the header says what is still missing. Slot order is
 * edited → raw → broll (the deliverable first). The scene strip and QC dots
 * live ABOVE this panel now (in VideoWorkCard), not inside it.
 */

// --- Mocks --------------------------------------------------------------

// Server actions are server-only ('use server'); stub them so the client
// component can import without pulling in Supabase/R2.
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'v1' })),
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  deleteR2Video: vi.fn(async () => ({ ok: true })),
  restoreR2Video: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview', provider: 'r2' })),
}))
vi.mock('@/lib/utils/video-postupload-client', () => ({
  processUploadedVideo: vi.fn().mockResolvedValue(undefined),
}))

// Real-shaped toast() return ({id, dismiss, update}) so the component's
// `t.dismiss()` after the undo window doesn't blow up on a bare vi.fn().
// Tests that need to inspect what a toast said/offered read toastSpy.mock.calls.
const toastSpy = vi.fn((..._args: unknown[]) => ({ id: 't1', dismiss: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}))

// Drives whether the user can see upload slots. Mutable across tests.
let canUpload = true
// Drives the read gate (revision/entregas/planning). Mutable across tests.
let canManageVideos = true
// The logged-in user's id — 'user-1' matches makeVideo()'s default uploaded_by,
// so existing tests (which don't care about ownership) keep passing unchanged.
let currentUserId: string | null = 'user-1'
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => canUpload,
  useHasAnyPermission: () => canManageVideos,
  useCurrentUserId: () => currentUserId,
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { registerR2Video, deleteR2Video, restoreR2Video } from '@/lib/actions/idea-videos-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'

function makeVideo(kind: ContentIdeaVideoKind, i: number): ContentIdeaVideo {
  return {
    id: `${kind}-${i}`,
    idea_id: 'idea-1',
    kind,
    name: `${kind}-${i}.mp4`,
    drive_file_id: `ideas/idea-1/${kind}/${i}.mp4`,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 1024 * 1024,
    duration_sec: null,
    notes: null,
    uploaded_by: 'user-1',
    status: 'uploaded',
    error_message: null,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// Uploads now go through the store engine (presign → PUT → register → maybe
// analyze), each step its own microtask hop — one act(async () => {}) only
// drains a single tick, so loop enough passes to settle the whole chain.
async function flush() {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve()
    })
  }
}

beforeEach(() => {
  canUpload = true
  canManageVideos = true
  currentUserId = 'user-1'
  vi.clearAllMocks()
})

describe('IdeaVideoPanel — compact upload view', () => {
  it('renders one "+" per group and summarizes what is missing', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    expect(screen.getByRole('button', { name: 'Añadir video editado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir material crudo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir b-roll' })).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })

  it('shows existing files under each group', async () => {
    const videos = [
      makeVideo('raw', 0),
      makeVideo('raw', 1),
      makeVideo('broll', 0),
      makeVideo('edited', 0),
    ]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)
    await flush()

    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('raw-1.mp4')).toBeInTheDocument()
    expect(screen.getByText('broll-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('edited-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('Faltan 2')).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('keeps a single "+" when the required count is complete', async () => {
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo('raw', i))
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} />)
    await flush()

    videos.forEach((v) => expect(screen.getByText(v.name)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Añadir material crudo' })).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('ignores non-uploaded (e.g. archived) videos when counting filled slots', async () => {
    const archived = { ...makeVideo('raw', 99), status: 'archived' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[archived]} />)
    await flush()

    expect(screen.queryByText('raw-99.mp4')).not.toBeInTheDocument()
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — orden: editado → crudo → b-roll', () => {
  it('renders the group headers top to bottom as Video editado, Video crudo, B-roll', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    const headers = screen.getAllByText(/Video editado|Video crudo|B-roll/)
    const order = headers.map((h) => h.textContent)
    const editedIdx = order.findIndex((t) => t?.includes('Video editado'))
    const rawIdx = order.findIndex((t) => t?.includes('Video crudo'))
    const brollIdx = order.findIndex((t) => t?.includes('B-roll'))
    expect(editedIdx).toBeGreaterThanOrEqual(0)
    expect(editedIdx).toBeLessThan(rawIdx)
    expect(rawIdx).toBeLessThan(brollIdx)
  })

  it('the hidden file inputs exist in edited → raw → broll order (3 groups)', async () => {
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()

    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(3)
    // Structural order check: the "edited" group's "+" (and its input) come
    // before "raw"'s in the DOM — actual upload-triggers-QC is covered below.
    const editedBtn = screen.getByRole('button', { name: 'Añadir video editado' })
    const rawBtn = screen.getByRole('button', { name: 'Añadir material crudo' })
    expect(editedBtn.compareDocumentPosition(rawBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('IdeaVideoPanel — borrado: el crudo no lo tiene, editado y b-roll sí', () => {
  it('no renders a delete button on a raw video', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
    // Labeled instead: the file is kept, never destructively deleted.
    expect(screen.getByText(/se conserva/i)).toBeInTheDocument()
  })

  it('renders a delete button on an edited video', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('edited', 0)]} />)
    await flush()
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument()
  })

  it('renders a delete button on a b-roll video', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('broll', 0)]} />)
    await flush()
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — borrar con confirmación propia + deshacer (no window.confirm)', () => {
  const originalConfirm = window.confirm

  beforeEach(() => {
    window.confirm = vi.fn(() => {
      throw new Error('window.confirm no debería usarse — el diálogo propio lo reemplaza')
    })
  })
  afterEach(() => {
    window.confirm = originalConfirm
  })

  it('clicking "Eliminar" opens the confirm dialog instead of window.confirm, and does nothing yet', async () => {
    const video = makeVideo('edited', 0)
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Eliminar este video editado\?/i)).toBeInTheDocument()
    expect(deleteR2Video).not.toHaveBeenCalled()
  })

  it('confirming archives (never destroys) and removes the card instantly, with an undo toast', async () => {
    const video = makeVideo('edited', 0)
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' })) // trash icon → opens dialog
    const confirmButtons = screen.getAllByRole('button', { name: 'Eliminar' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1]) // dialog's own confirm button
    await flush()

    expect(deleteR2Video).toHaveBeenCalledWith(video.id, 'idea-1')
    // Optimistic removal: the file row is gone immediately.
    expect(screen.queryByText('edited-0.mp4')).not.toBeInTheDocument()
    // A toast with an undo action was shown.
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/eliminado/i), action: expect.anything() }),
    )
  })

  it('cancelling the confirm dialog leaves the card and never calls deleteR2Video', async () => {
    const video = makeVideo('edited', 0)
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await flush()

    expect(deleteR2Video).not.toHaveBeenCalled()
    expect(screen.getByText('edited-0.mp4')).toBeInTheDocument()
  })

  it('clicking "Deshacer" in the toast restores the row', async () => {
    const video = makeVideo('edited', 0)
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' })) // trash icon → opens dialog
    const confirmButtons = screen.getAllByRole('button', { name: 'Eliminar' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1]) // dialog's own confirm button
    await flush()
    expect(screen.queryByText('edited-0.mp4')).not.toBeInTheDocument()

    // Pull the action element out of the toast call and click it — the same
    // way Toaster would render it, without needing the full Toaster tree.
    const call = toastSpy.mock.calls.find((c) => (c[0] as { action?: unknown }).action)
    expect(call).toBeDefined()
    const action = (call![0] as { action: React.ReactElement }).action
    render(action)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/i }))
    await flush()

    expect(restoreR2Video).toHaveBeenCalledWith(video.id, 'idea-1')
    expect(screen.getByText('edited-0.mp4')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — per-video status badges', () => {
  it('shows a "Subido" badge and the R2 storage tag for an uploaded R2 video', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.getByText('Subido')).toBeInTheDocument()
    expect(screen.getAllByText('R2').length).toBeGreaterThan(0)
  })

  it('shows a "Público" badge ONLY for edited videos when public access is enabled', async () => {
    const videos = [makeVideo('raw', 0), makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled />)
    await flush()
    expect(screen.getAllByText('Público')).toHaveLength(1)
  })

  it('does NOT show "Público" when public access is disabled', async () => {
    const videos = [makeVideo('edited', 0)]
    render(<IdeaVideoPanel ideaId="idea-1" videos={videos} publicEnabled={false} />)
    await flush()
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
  })

  it('does NOT mark a Drive-stored edited video as Público', async () => {
    const driveEdited = { ...makeVideo('edited', 0), storage_provider: 'drive' as const, drive_view_link: 'https://drive/x' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0), driveEdited]} publicEnabled />)
    await flush()
    expect(screen.queryByText('Público')).not.toBeInTheDocument()
    expect(screen.getAllByText('Drive').length).toBeGreaterThan(0)
  })

  it('labels Entregas R2 files with their real storage provider', async () => {
    const entregasVideo = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregasVideo]} />)
    await flush()
    expect(screen.getByText('Entregas R2')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — metadatos abreviados', () => {
  it('shows size · first name · short date, with the full detail in the title', async () => {
    const v = {
      ...makeVideo('edited', 0),
      uploaded_at: '2026-06-02T15:42:00.000Z',
      uploader: { id: 'user-1', full_name: 'Alexa Kerocen', email: 'alexa@example.com' },
    }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[v]} />)
    await flush()

    const meta = screen.getByText(/Alexa/i)
    expect(meta.textContent).not.toMatch(/kerocen/i)
    expect(meta.textContent).not.toMatch(/subido por/i)
    expect(meta.textContent).not.toMatch(/\d{1,2}:\d{2}/) // no time in the short label
    expect(meta).toHaveAttribute('title', expect.stringMatching(/subido por Alexa Kerocen/i))
  })

  it('omits the uploader segment when there is no uploader profile', async () => {
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.queryByText(/subido por/i)).not.toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — permission gating', () => {
  it('does not render "+" triggers when the user lacks video.upload', async () => {
    canUpload = false
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    expect(screen.queryAllByRole('button', { name: /^Añadir /i })).toHaveLength(0)
    // The compact headers still communicate the missing requirements.
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Faltan 4')).toBeInTheDocument()
    expect(screen.getByText('Opcional')).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — inline preview', () => {
  it('shows a "Ver" button for an uploaded R2 video', async () => {
    canUpload = true
    render(<IdeaVideoPanel ideaId="idea-1" videos={[makeVideo('raw', 0)]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })

  it('shows a "Ver" button for entregas-r2 videos so dual-R2 files stay viewable', async () => {
    canUpload = true
    const entregas = { ...makeVideo('edited', 0), storage_provider: 'entregas-r2' as const }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[entregas]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — "Ver"/"Bajar" solo cuando el permiso o la autoría los respalda (coordinator follow-up)', () => {
  it('con permiso de lectura (revision/entregas/planning), muestra Ver y Bajar aunque el video sea de OTRO usuario', async () => {
    canManageVideos = true
    currentUserId = 'user-1'
    const video = { ...makeVideo('raw', 0), uploaded_by: 'otro-usuario' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bajar/ })).toBeInTheDocument()
  })

  it('sin permiso pero es SU PROPIA subida (uploaded_by === yo), igual muestra Ver y Bajar', async () => {
    canManageVideos = false
    currentUserId = 'video-role-user'
    const video = { ...makeVideo('raw', 0), uploaded_by: 'video-role-user' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bajar/ })).toBeInTheDocument()
  })

  it('sin permiso Y de otro usuario → ni Ver ni Bajar se renderizan (un botón que siempre falla es peor que ninguno)', async () => {
    canManageVideos = false
    currentUserId = 'video-role-user'
    const video = { ...makeVideo('raw', 0), uploaded_by: 'otro-usuario-cualquiera' }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bajar/ })).not.toBeInTheDocument()
  })

  it('sin permiso y sin sesión (uploaded_by null) → tampoco se renderizan', async () => {
    canManageVideos = false
    currentUserId = null
    const video = { ...makeVideo('raw', 0), uploaded_by: null }
    render(<IdeaVideoPanel ideaId="idea-1" videos={[video]} />)
    await flush()
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bajar/ })).not.toBeInTheDocument()
  })
})

describe('IdeaVideoPanel — dispara QC IA en subida de editado', () => {
  const OriginalXHR = global.XMLHttpRequest

  // getR2UploadUrl/registerR2Video are mocked at module scope; the actual
  // R2 PUT goes through XMLHttpRequest, which jsdom leaves unmocked (a real
  // request to it would hang). Stub it to succeed synchronously so uploadOne
  // reaches registerR2Video.
  class FakeXHR {
    status = 200
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    getResponseHeader() { return null }
    send() {
      this.onload?.()
    }
  }

  beforeEach(() => {
    // @ts-expect-error test stub, not a full XMLHttpRequest
    global.XMLHttpRequest = FakeXHR
  })
  afterEach(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('subir en el slot "edited" dispara processUploadedVideo con el id registrado', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-9' })
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    // Order is edited → raw → broll.
    const inputs = container.querySelectorAll('input[type="file"]')
    const editedInput = inputs[0] as HTMLInputElement
    const file = new File(['x'], 'final.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.change(editedInput, { target: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(processUploadedVideo)).toHaveBeenCalledWith('vid-9', expect.any(File))
  })

  it('subir en el slot "raw" NO dispara processUploadedVideo', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-raw' })
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    const inputs = container.querySelectorAll('input[type="file"]')
    const rawInput = inputs[1] as HTMLInputElement
    const file = new File(['x'], 'raw.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.change(rawInput, { target: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(processUploadedVideo)).not.toHaveBeenCalled()
  })
})

describe('IdeaVideoPanel — arrastrar y soltar (sin la caja grande)', () => {
  const OriginalXHR = global.XMLHttpRequest
  class FakeXHR {
    status = 200
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    getResponseHeader() { return null }
    send() { this.onload?.() }
  }
  beforeEach(() => {
    // @ts-expect-error test stub, not a full XMLHttpRequest
    global.XMLHttpRequest = FakeXHR
  })
  afterEach(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('a drop on the group still registers the upload', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-drop' })
    render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()

    const group = screen.getByRole('button', { name: 'Añadir material crudo' }).closest('[data-slot-group="raw"]')
    expect(group).not.toBeNull()
    const file = new File(['x'], 'dropped.mp4', { type: 'video/mp4' })
    await act(async () => {
      fireEvent.drop(group as Element, { dataTransfer: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(registerR2Video)).toHaveBeenCalled()
  })

  it('el crudo se registra con el título de la idea, no IMG_8841', async () => {
    vi.mocked(registerR2Video).mockResolvedValueOnce({ ok: true, id: 'vid-raw' })
    render(<IdeaVideoPanel ideaId="idea-1" ideaTitle="El primer sandwich del día" videos={[]} />)
    await flush()

    const group = screen.getByRole('button', { name: 'Añadir material crudo' }).closest('[data-slot-group="raw"]')
    const file = new File(['x'], 'IMG_8841.MOV', { type: 'video/quicktime' })
    await act(async () => {
      fireEvent.drop(group as Element, { dataTransfer: { files: [file] } })
    })
    await flush()

    expect(vi.mocked(registerR2Video)).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'raw', name: 'El primer sandwich del día.MOV' }),
    )
  })
})

describe('IdeaVideoPanel — multi-file upload', () => {
  it('every upload input accepts multiple files', async () => {
    canUpload = true
    const { container } = render(<IdeaVideoPanel ideaId="idea-1" videos={[]} />)
    await flush()
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(3)
    inputs.forEach((input) => expect(input).toHaveAttribute('multiple'))
  })
})
