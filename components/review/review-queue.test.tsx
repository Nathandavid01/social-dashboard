import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ReviewQueue, type QueueVideo } from './review-queue'

function video(over: Partial<QueueVideo> = {}): QueueVideo {
  return {
    id: 'v1',
    videoFileId: 'f1',
    title: 'Rutina de piernas',
    clientName: 'Nora Fitness',
    approval_status: 'submitted',
    submitted_by: 'editor-1',
    submittedByName: 'Ana',
    ...over,
  }
}

const getPreviewUrl = vi.fn<(id: string) => Promise<{ url?: string; error?: string }>>(
  async () => ({ url: 'https://r2.example/signed.mp4' }),
)
const onDecide = vi.fn(async () => {})

beforeEach(() => {
  cleanup()
  getPreviewUrl.mockReset()
  getPreviewUrl.mockResolvedValue({ url: 'https://r2.example/signed.mp4' })
  onDecide.mockReset()
  onDecide.mockResolvedValue(undefined)
})

function renderQueue(videos: QueueVideo[]) {
  return render(
    <ReviewQueue
      videos={videos}
      role="supervisor"
      userId="sup-1"
      getPreviewUrl={getPreviewUrl}
      onDecide={onDecide}
    />,
  )
}

const three = [
  video({ id: 'v1', videoFileId: 'f1', title: 'Uno' }),
  video({ id: 'v2', videoFileId: 'f2', title: 'Dos' }),
  video({ id: 'v3', videoFileId: 'f3', title: 'Tres' }),
]

describe('ReviewQueue — one video at a time', () => {
  it('opens on the first pending video with a progress counter', async () => {
    renderQueue(three)
    expect(await screen.findByText('Uno')).toBeInTheDocument()
    expect(screen.getByText(/0 de 3 revisados/i)).toBeInTheDocument()
  })

  it('only asks for the signed URL of the video on screen', async () => {
    renderQueue(three)
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledTimes(1))
    expect(getPreviewUrl).toHaveBeenCalledWith('f1')
  })

  it('plays the signed URL it fetched', async () => {
    const { container } = renderQueue(three)
    await waitFor(() => {
      expect(container.querySelector('video')).toHaveAttribute('src', 'https://r2.example/signed.mp4')
    })
  })

  it('approving persists that video and moves to the next', async () => {
    renderQueue(three)
    await screen.findByText('Uno')
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith('v1', 'approve', ''))
    expect(await screen.findByText('Dos')).toBeInTheDocument()
    expect(screen.getByText(/1 de 3 revisados/i)).toBeInTheDocument()
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledWith('f2'))
  })

  it('sending back records the note and also moves on', async () => {
    renderQueue(three)
    await screen.findByText('Uno')
    fireEvent.change(screen.getByPlaceholderText(/qué hay que cambiar/i), {
      target: { value: 'Corta los primeros 2s' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pedir cambios/i }))
    await waitFor(() =>
      expect(onDecide).toHaveBeenCalledWith('v1', 'request_changes', 'Corta los primeros 2s'),
    )
    expect(await screen.findByText('Dos')).toBeInTheDocument()
  })

  it('skips videos that were already decided', async () => {
    renderQueue([
      video({ id: 'v1', videoFileId: 'f1', title: 'Uno', approval_status: 'approved' }),
      video({ id: 'v2', videoFileId: 'f2', title: 'Dos' }),
    ])
    expect(await screen.findByText('Dos')).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 revisados/i)).toBeInTheDocument()
  })

  it('says it is done when nothing is left to review', async () => {
    renderQueue([video({ id: 'v1', approval_status: 'approved' })])
    expect(await screen.findByText(/no queda nada por revisar/i)).toBeInTheDocument()
    expect(getPreviewUrl).not.toHaveBeenCalled()
  })

  it('reaches the done state after deciding the last one', async () => {
    renderQueue([video({ id: 'v1', videoFileId: 'f1', title: 'Único' })])
    await screen.findByText('Único')
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    expect(await screen.findByText(/no queda nada por revisar/i)).toBeInTheDocument()
  })

  it('surfaces a failed URL instead of showing a dead player', async () => {
    getPreviewUrl.mockResolvedValue({ error: 'R2 no está configurado' })
    renderQueue([video()])
    expect(await screen.findByText(/R2 no está configurado/i)).toBeInTheDocument()
  })

  it('keeps the decision buttons usable even if the video will not load', async () => {
    getPreviewUrl.mockResolvedValue({ error: 'boom' })
    renderQueue([video()])
    await screen.findByText(/boom/i)
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeEnabled()
  })

  it('lets the reviewer step through without deciding', async () => {
    renderQueue(three)
    await screen.findByText('Uno')
    fireEvent.click(screen.getByRole('button', { name: /siguiente video/i }))
    expect(await screen.findByText('Dos')).toBeInTheDocument()
    expect(onDecide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /video anterior/i }))
    expect(await screen.findByText('Uno')).toBeInTheDocument()
  })
})
