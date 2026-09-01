import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoCover } from './video-cover'

const actionMocks = vi.hoisted(() => ({
  getPipelineVideoThumbViewUrls: vi.fn(),
  getVideoPreviewUrl: vi.fn(),
}))

vi.mock('@/lib/actions/video-thumbs', () => ({
  getPipelineVideoThumbViewUrls: actionMocks.getPipelineVideoThumbViewUrls,
}))

vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: actionMocks.getVideoPreviewUrl,
}))

describe('VideoCover', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usa la primera miniatura guardada como carátula', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({
      urls: ['https://cdn.example/frame-1.jpg', 'https://cdn.example/frame-2.jpg'],
    })

    render(<VideoCover videoId="video-1" title="Video Prueba 9pm" />)

    const cover = await screen.findByRole('img', { name: 'Carátula de Video Prueba 9pm' })
    expect(cover).toHaveAttribute('src', 'https://cdn.example/frame-1.jpg')
  })

  // Cambio de producto (v4.3, pedido de Eric): "tiene que tener una foto, no
  // puede ser negro" — sin thumbs guardados, se pinta un frame real al vuelo.
  it('sin carátula guardada cae al frame al vuelo (video oculto), no al placeholder', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({ urls: [] })
    actionMocks.getVideoPreviewUrl.mockResolvedValue({ url: 'https://cdn.example/video.mp4' })

    render(<VideoCover videoId="video-2" title="Video Prueba 9pm" />)

    await waitFor(() => expect(actionMocks.getVideoPreviewUrl).toHaveBeenCalledWith('video-2'))
    await waitFor(() => expect(document.querySelector('video')).toBeInTheDocument())
    expect(screen.queryByLabelText('Carátula no disponible')).not.toBeInTheDocument()
  })
})
