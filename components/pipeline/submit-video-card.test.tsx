import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type React from 'react'

// Radix Select needs pointer APIs jsdom lacks; stub it to a native control.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="Cliente" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

import { SubmitVideoCard, MAX_VIDEO_BYTES } from './submit-video-card'

const CLIENTS = [{ id: 'c1', name: 'Nora Fitness' }, { id: 'c2', name: 'Gym Titan' }]
const DRIVE = 'https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQr/view'

function videoFile(name = 'reel.mp4', size = 5_000_000, type = 'video/mp4'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const onSubmit = vi.fn()
beforeEach(() => { cleanup(); onSubmit.mockReset() })

function setup() {
  render(<SubmitVideoCard clients={CLIENTS} onSubmit={onSubmit} />)
  const files = () => screen.getAllByLabelText(/archivo del video/i) as HTMLInputElement[]
  return {
    client: screen.getByLabelText('Cliente') as HTMLSelectElement,
    count: screen.getByLabelText(/cuántos videos/i) as HTMLInputElement,
    files,
    pick: (i: number, f: File) => fireEvent.change(files()[i], { target: { files: [f] } }),
    submit: () => screen.getByRole('button', { name: /enviar a revisión/i }),
  }
}

describe('SubmitVideoCard — the editor uploads the real file', () => {
  it('no pide "de qué es el video" — eso se escribe en Copy', () => {
    setup()
    expect(screen.queryByLabelText(/de qué es el video/i)).toBeNull()
  })

  it('asks for a video file, not a link', () => {
    const { files } = setup()
    expect(files()[0]).toHaveAttribute('type', 'file')
    expect(files()[0]).toHaveAttribute('accept', 'video/*')
  })

  it('still gives one row per video asked for', () => {
    const { count, files } = setup()
    fireEvent.change(count, { target: { value: '3' } })
    expect(files()).toHaveLength(3)
  })

  it('shows the chosen file name so the editor can check it', () => {
    const { pick } = setup()
    pick(0, videoFile('rutina-piernas.mp4'))
    expect(screen.getByText(/rutina-piernas\.mp4/)).toBeInTheDocument()
  })

  it('needs a client and a file in every row', () => {
    const { client, count, pick, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    expect(submit()).toBeDisabled()
    pick(0, videoFile('a.mp4'))
    expect(submit()).toBeDisabled()
    pick(1, videoFile('b.mp4'))
    expect(submit()).toBeEnabled()
  })

  it('rejects a file that is not a video', () => {
    const { client, pick, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile('notas.pdf', 1000, 'application/pdf'))
    expect(screen.getByText(/tiene que ser un video/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('rejects a file over the size cap instead of failing mid-upload', () => {
    const { client, pick, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile('enorme.mp4', MAX_VIDEO_BYTES + 1))
    expect(screen.getByText(/demasiado grande/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('catches the same file picked twice', () => {
    const { client, count, pick, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile('reel.mp4', 123))
    pick(1, videoFile('reel.mp4', 123))
    expect(screen.getByText(/ya está en otro campo/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('the Drive link is optional and never blocks the submission', () => {
    const { client, pick, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile())
    expect(submit()).toBeEnabled()                       // no link at all → fine
    const link = screen.getByLabelText(/enlace de drive .*opcional/i)
    fireEvent.change(link, { target: { value: 'no-es-un-link' } })
    expect(submit()).toBeEnabled()                       // junk link → still fine
  })

  it('hands the parent the actual File objects to upload', () => {
    const { client, pick, submit } = setup()
    fireEvent.change(client, { target: { value: 'c2' } })
    const f = videoFile('reel-abril.mp4', 42)
    pick(0, f)
    fireEvent.change(screen.getByLabelText(/enlace de drive .*opcional/i), { target: { value: DRIVE } })
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Reel de abril' } })
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'c2',
      videos: [{ file: f, driveLink: DRIVE, title: 'Reel de abril' }],
    })
  })

  it('falls back to a client-based title and a null link', () => {
    const { client, pick, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile())
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'c1',
      videos: [expect.objectContaining({ title: 'Nora Fitness — video 1', driveLink: null })],
    })
  })

  it('reports progress as "N de M listos"', () => {
    const { client, count, pick } = setup()
    fireEvent.change(count, { target: { value: '3' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile('a.mp4'))
    expect(screen.getByText(/1 de 3 listos/i)).toBeInTheDocument()
  })

  it('clears back to one empty row after submitting', () => {
    const { client, count, pick, files, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    pick(0, videoFile('a.mp4'))
    pick(1, videoFile('b.mp4'))
    fireEvent.click(submit())
    expect(files()).toHaveLength(1)
    expect(submit()).toBeDisabled()
  })
})
