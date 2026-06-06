import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { RecordedVideoForm } from './recorded-video-form'

const clients = [
  { id: 'c1', name: 'Bella Boutique' },
  { id: 'c2', name: 'Sabor Criollo' },
]
const team = [
  { id: 'u1', name: 'Carlos' },
  { id: 'u2', name: 'Ana' },
]

function setup(overrides: Partial<React.ComponentProps<typeof RecordedVideoForm>> = {}) {
  const onCreate = vi.fn(async () => ({ ideaId: 'idea-1' }))
  const onGenerateCaption = vi.fn(async () => ({ caption: 'CAPTION IA ✨ #BlackFriday' }))
  const onDone = vi.fn()
  render(
    <RecordedVideoForm
      clients={clients}
      team={team}
      onCreate={onCreate}
      onGenerateCaption={onGenerateCaption}
      onDone={onDone}
      {...overrides}
    />,
  )
  return { onCreate, onGenerateCaption, onDone }
}

beforeEach(() => cleanup())

describe('RecordedVideoForm — classification indicator', () => {
  it('defaults to the Video column and shows what it skips', () => {
    setup()
    expect(screen.getByText(/salta Idea, Title, Caption/i)).toBeTruthy()
  })

  it('updates the indicator when the entry column changes to Edited', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Edited$/i }))
    expect(screen.getByText(/salta Idea, Title, Caption, Video/i)).toBeTruthy()
  })
})

describe('RecordedVideoForm — raw videos (up to 5)', () => {
  it('lets the user add raw link inputs up to 5 then disables adding', () => {
    setup()
    const addBtn = screen.getByRole('button', { name: /agregar raw/i })
    expect(screen.getAllByPlaceholderText(/link de drive \(raw/i)).toHaveLength(1)
    for (let i = 0; i < 4; i++) fireEvent.click(addBtn)
    expect(screen.getAllByPlaceholderText(/link de drive \(raw/i)).toHaveLength(5)
    expect((addBtn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('RecordedVideoForm — caption AI', () => {
  it('generate is disabled until a title is typed', () => {
    setup()
    expect((screen.getByRole('button', { name: /generar con ia/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('fills the caption field from the AI when generate is clicked', async () => {
    const { onGenerateCaption } = setup()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Promo Black Friday' } })
    fireEvent.click(screen.getByRole('button', { name: /generar con ia/i }))
    await waitFor(() => expect(onGenerateCaption).toHaveBeenCalledWith({ clientId: 'c1', title: 'Promo Black Friday' }))
    await waitFor(() =>
      expect((screen.getByLabelText(/caption/i) as HTMLTextAreaElement).value).toContain('CAPTION IA'),
    )
  })
})

describe('RecordedVideoForm — submit', () => {
  it('disables submit until client and title are set', () => {
    setup()
    expect((screen.getByRole('button', { name: /clasificar y crear/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('submits the assembled payload (stage, links, assignee)', async () => {
    const { onCreate, onDone } = setup()
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } })
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Promo Black Friday' } })
    fireEvent.change(screen.getByLabelText(/asignado a/i), { target: { value: 'u1' } })
    fireEvent.change(screen.getAllByPlaceholderText(/link de drive \(raw/i)[0], {
      target: { value: 'https://drive.google.com/raw1' },
    })
    fireEvent.change(screen.getByPlaceholderText(/link de drive \(editado/i), {
      target: { value: 'https://drive.google.com/edited' },
    })
    fireEvent.click(screen.getByRole('button', { name: /clasificar y crear/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect((onCreate.mock.calls as unknown as any[][])[0][0]).toMatchObject({
      clientId: 'c1',
      title: 'Promo Black Friday',
      entryStage: 'video',
      assigneeId: 'u1',
      rawLinks: ['https://drive.google.com/raw1'],
      editedLink: 'https://drive.google.com/edited',
    })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
