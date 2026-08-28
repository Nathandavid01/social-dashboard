import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoCover } from './video-cover'

const actionMocks = vi.hoisted(() => ({
  getVideoThumbViewUrls: vi.fn(),
  getVideoPreviewUrl: vi.fn(),
}))

vi.mock('@/lib/actions/video-thumbs', () => ({
  getVideoThumbViewUrls: actionMocks.getVideoThumbViewUrls,
}))

vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: actionMocks.getVideoPreviewUrl,
}))

describe('VideoCover', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usa la primera miniatura guardada como carátula', async () => {
    actionMocks.getVideoThumbViewUrls.mockResolvedValue({
      urls: ['https://cdn.example/frame-1.jpg', 'https://cdn.example/frame-2.jpg'],
    })

    render(<VideoCover videoId="video-1" title="Video Prueba 9pm" />)

    const cover = await screen.findByRole('img', { name: 'Carátula de Video Prueba 9pm' })
    expect(cover).toHaveAttribute('src', 'https://cdn.example/frame-1.jpg')
    expect(actionMocks.getVideoPreviewUrl).not.toHaveBeenCalled()
  })

  it('muestra un fotograma del video cuando no hay miniatura guardada', async () => {
    actionMocks.getVideoThumbViewUrls.mockResolvedValue({ urls: [] })
    actionMocks.getVideoPreviewUrl.mockResolvedValue({ url: 'https://cdn.example/video.mp4' })

    render(<VideoCover videoId="video-2" title="Video Prueba 9pm" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Carátula de Video Prueba 9pm')).toHaveAttribute(
        'src',
        'https://cdn.example/video.mp4',
      )
    })
  })
})
