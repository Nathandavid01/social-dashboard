import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const refresh = vi.fn()
const toast = vi.fn()
const startUpload = vi.fn(() => 'up-1')
const createBankIdea = vi.fn(async (_input: { clientId: string; title: string }): Promise<{ ideaId?: string; error?: string }> => ({ ideaId: 'idea-new' }))
const ensureClientBrollLibrary = vi.fn(async (_input: { clientId: string; clientName: string }): Promise<{ ideaId?: string; error?: string }> => ({ ideaId: 'broll-lib' }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/lib/stores/upload-store', () => ({
  useUploadStore: (sel: (s: { startUpload: typeof startUpload }) => unknown) => sel({ startUpload }),
}))
vi.mock('@/lib/actions/banco-direct-upload', () => ({
  createBankIdea: (input: { clientId: string; title: string }) => createBankIdea(input),
  ensureClientBrollLibrary: (input: { clientId: string; clientName: string }) => ensureClientBrollLibrary(input),
}))

import { BancoUploadDialog } from './banco-upload-dialog'
import type { AttachableBankIdea } from '@/lib/pipeline/banco-direct-upload'

const clients = [
  { id: 'c1', name: 'ARASIBO' },
  { id: 'c2', name: 'Nora Fitness' },
]
const ideas: AttachableBankIdea[] = [
  { id: 'i1', title: 'Intro clínica', clientId: 'c1', status: 'grabada', approval_status: 'pending' },
  { id: 'i2', title: 'Otra marca', clientId: 'c2', status: 'idea', approval_status: null },
]

function open() {
  render(<BancoUploadDialog clients={clients} ideas={ideas} />)
  fireEvent.click(screen.getByRole('button', { name: /subir videos/i }))
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
  createBankIdea.mockReset().mockResolvedValue({ ideaId: 'idea-new' })
  ensureClientBrollLibrary.mockReset().mockResolvedValue({ ideaId: 'broll-lib' })
})

describe('BancoUploadDialog', () => {
  it('abre el diálogo para subir al banco sin grabación agendada', () => {
    open()
    expect(screen.getByRole('heading', { name: /subir al banco/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/cliente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^subir$/i })).toBeDisabled()
  })

  it('no deja enviar sin cliente y sin video', () => {
    open()
    expect(screen.getByRole('button', { name: /^subir$/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    expect(screen.getByRole('button', { name: /^subir$/i })).toBeDisabled()
    pickFile()
    expect(screen.getByRole('button', { name: /^subir$/i })).toBeEnabled()
  })

  it('crea una idea nueva sin sesión y arranca la subida del crudo', async () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Toma extra' } })
    const file = pickFile()
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    await waitFor(() =>
      expect(createBankIdea).toHaveBeenCalledWith({ clientId: 'c1', title: 'Toma extra' }),
    )
    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        ideaId: 'idea-new',
        kind: 'raw',
        provider: 'r2',
        title: 'Toma extra',
      })),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('si no escribes título, usa el nombre del archivo', async () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    pickFile('Sandwich del día.mp4', 'video/mp4')
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    await waitFor(() =>
      expect(createBankIdea).toHaveBeenCalledWith({ clientId: 'c1', title: 'Sandwich del día' }),
    )
  })

  it('pega los archivos a una idea existente y no crea otra', async () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('radio', { name: /idea existente/i }))
    fireEvent.change(screen.getByLabelText(/^idea$/i), { target: { value: 'i1' } })
    const file = pickFile()
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        ideaId: 'i1',
        kind: 'raw',
      })),
    )
    expect(createBankIdea).not.toHaveBeenCalled()
  })

  it('la lista de ideas existentes solo muestra las de ese cliente', () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('radio', { name: /idea existente/i }))
    const select = screen.getByLabelText(/^idea$/i)
    expect(select).toHaveTextContent('Intro clínica')
    expect(select).not.toHaveTextContent('Otra marca')
  })

  it('el B-roll va a la librería permanente del cliente, no a una idea suelta', async () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('radio', { name: /b-roll/i }))
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    await waitFor(() =>
      expect(ensureClientBrollLibrary).toHaveBeenCalledWith({ clientId: 'c1', clientName: 'ARASIBO' }),
    )
    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(expect.objectContaining({ ideaId: 'broll-lib', kind: 'broll' })),
    )
    expect(createBankIdea).not.toHaveBeenCalled()
  })

  it('rechaza un archivo que no es video', () => {
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    pickFile('notas.html', 'text/html')
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    expect(screen.getByText(/solo se aceptan videos/i)).toBeInTheDocument()
    expect(createBankIdea).not.toHaveBeenCalled()
    expect(startUpload).not.toHaveBeenCalled()
  })

  it('si falla crear la idea, no empieza a subir', async () => {
    createBankIdea.mockResolvedValueOnce({ error: 'No autorizado' })
    open()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(startUpload).not.toHaveBeenCalled()
  })
})
