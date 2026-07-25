import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
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
const ID1 = '1A2b3C4d5E6f7G8h9I0jKlMnOpQr'
const ID2 = '2B3c4D5e6F7g8H9i0J1kLmNoPqRs'
const LINK1 = `https://drive.google.com/file/d/${ID1}/view?usp=sharing`
const LINK2 = `https://drive.google.com/file/d/${ID2}/view`

const onSubmit = vi.fn()
beforeEach(() => { cleanup(); onSubmit.mockReset() })

function setup() {
  render(<SubmitVideoCard clients={CLIENTS} onSubmit={onSubmit} />)
  const links = () => screen.getAllByLabelText(/enlace de google drive/i) as HTMLInputElement[]
  return {
    client: screen.getByLabelText('Cliente') as HTMLSelectElement,
    count: screen.getByLabelText(/cuántos videos/i) as HTMLInputElement,
    links,
    submit: () => screen.getByRole('button', { name: /enviar a revisión/i }),
  }
}

describe('SubmitVideoCard — how many videos, then that many Drive boxes', () => {
  it('starts with one link box', () => {
    const { links } = setup()
    expect(links()).toHaveLength(1)
  })

  it('gives you exactly as many link boxes as videos you asked for', () => {
    const { count, links } = setup()
    fireEvent.change(count, { target: { value: '3' } })
    expect(links()).toHaveLength(3)
    fireEvent.change(count, { target: { value: '5' } })
    expect(links()).toHaveLength(5)
  })

  it('numbers each box so the editor knows which video is which', () => {
    const { count } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
  })

  it('keeps what was already typed when the count grows', () => {
    const { count, links } = setup()
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    fireEvent.change(count, { target: { value: '3' } })
    expect(links()[0].value).toBe(LINK1)
    expect(links()[1].value).toBe('')
  })

  it('drops the extra boxes when the count shrinks', () => {
    const { count, links } = setup()
    fireEvent.change(count, { target: { value: '3' } })
    fireEvent.change(links()[2], { target: { value: LINK1 } })
    fireEvent.change(count, { target: { value: '1' } })
    expect(links()).toHaveLength(1)
    expect(links()[0].value).toBe('')
  })

  it('refuses a count below 1 or above the cap', () => {
    const { count, links } = setup()
    fireEvent.change(count, { target: { value: '0' } })
    expect(links()).toHaveLength(1)
    fireEvent.change(count, { target: { value: '99' } })
    expect(links()).toHaveLength(10)
  })

  it('needs a client AND every box filled with a valid link', () => {
    const { client, count, links, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    expect(submit()).toBeDisabled()

    fireEvent.change(links()[0], { target: { value: LINK1 } })
    expect(submit()).toBeDisabled()          // second box still empty

    fireEvent.change(links()[1], { target: { value: LINK2 } })
    expect(submit()).toBeEnabled()
  })

  it('one bad link among several blocks the whole submission', () => {
    const { client, count, links, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    fireEvent.change(links()[1], { target: { value: 'https://youtube.com/watch?v=x' } })
    expect(screen.getByText(/no parece un link de google drive/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('rejects the same Drive file pasted twice', () => {
    const { client, count, links, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    fireEvent.change(links()[1], { target: { value: LINK1 } })
    expect(screen.getByText(/ya está en otro campo/i)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('reports the client once and every video with its parsed file id', () => {
    const { client, count, links, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c2' } })
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    fireEvent.change(links()[1], { target: { value: LINK2 } })
    const titles = screen.getAllByLabelText(/título/i) as HTMLInputElement[]
    fireEvent.change(titles[0], { target: { value: 'Reel de abril' } })
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'c2',
      videos: [
        { driveLink: LINK1, driveFileId: ID1, title: 'Reel de abril' },
        { driveLink: LINK2, driveFileId: ID2, title: 'Gym Titan — video 2' },
      ],
    })
  })

  it('clears back to one empty box after submitting', () => {
    const { client, count, links, submit } = setup()
    fireEvent.change(count, { target: { value: '2' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    fireEvent.change(links()[1], { target: { value: LINK2 } })
    fireEvent.click(submit())
    expect(links()).toHaveLength(1)
    expect(links()[0].value).toBe('')
    expect(submit()).toBeDisabled()
  })

  it('says how many videos are going to review', () => {
    const { client, count, links } = setup()
    fireEvent.change(count, { target: { value: '3' } })
    fireEvent.change(client, { target: { value: 'c1' } })
    fireEvent.change(links()[0], { target: { value: LINK1 } })
    expect(screen.getByText(/1 de 3 listos/i)).toBeInTheDocument()
  })
})
