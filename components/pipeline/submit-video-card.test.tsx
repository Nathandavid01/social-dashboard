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

import { SubmitVideoCard } from './submit-video-card'

const CLIENTS = [{ id: 'c1', name: 'Nora Fitness' }, { id: 'c2', name: 'Gym Titan' }]
const LINK = 'https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQr/view?usp=sharing'
const FILE_ID = '1A2b3C4d5E6f7G8h9I0jKlMnOpQr'

const onSubmit = vi.fn()
beforeEach(() => { cleanup(); onSubmit.mockReset() })

function setup() {
  render(<SubmitVideoCard clients={CLIENTS} onSubmit={onSubmit} />)
  return {
    client: screen.getByLabelText('Cliente') as HTMLSelectElement,
    link: screen.getByLabelText(/enlace de google drive/i) as HTMLInputElement,
    submit: () => screen.getByRole('button', { name: /enviar a revisión/i }),
  }
}

describe('SubmitVideoCard — the editor submits from the Video column', () => {
  it('lists every client in the dropdown', () => {
    setup()
    for (const c of CLIENTS) expect(screen.getByRole('option', { name: c.name })).toBeInTheDocument()
  })

  it('has a box for the Google Drive link', () => {
    const { link } = setup()
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('placeholder', expect.stringContaining('drive.google.com'))
  })

  it('cannot submit until a client is picked AND the link is valid', () => {
    const { client, link, submit } = setup()
    expect(submit()).toBeDisabled()

    fireEvent.change(client, { target: { value: 'c1' } })
    expect(submit()).toBeDisabled()          // client alone is not enough

    fireEvent.change(link, { target: { value: LINK } })
    expect(submit()).toBeEnabled()
  })

  it('a client with no link cannot be submitted', () => {
    const { link, client, submit } = setup()
    fireEvent.change(link, { target: { value: LINK } })
    expect(submit()).toBeDisabled()          // link alone is not enough
    fireEvent.change(client, { target: { value: 'c2' } })
    expect(submit()).toBeEnabled()
  })

  it('explains a bad link instead of silently refusing', () => {
    const { client, link, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(link, { target: { value: 'https://youtube.com/watch?v=x' } })
    expect(screen.getByText(/no parece un link de google drive/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('confirms a good link as it is pasted', () => {
    const { link } = setup()
    fireEvent.change(link, { target: { value: LINK } })
    expect(screen.getByText(/link de drive válido/i)).toBeInTheDocument()
  })

  it('reports the client, the raw link and the parsed file id', () => {
    const { client, link, submit } = setup()
    fireEvent.change(client, { target: { value: 'c2' } })
    fireEvent.change(link, { target: { value: LINK } })
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Reel de abril' } })
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'c2',
      driveLink: LINK,
      driveFileId: FILE_ID,
      title: 'Reel de abril',
    })
  })

  it('titles the video after the client when the editor leaves it blank', () => {
    const { client, link, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(link, { target: { value: LINK } })
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nora Fitness — video sin título' }))
  })

  it('clears itself after a submission so the next one starts fresh', () => {
    const { client, link, submit } = setup()
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(link, { target: { value: LINK } })
    fireEvent.click(submit())
    expect(link.value).toBe('')
    expect(submit()).toBeDisabled()
  })
})
