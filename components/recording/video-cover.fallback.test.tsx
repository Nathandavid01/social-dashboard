import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VideoCover } from './video-cover'

/**
 * "Tiene que tener una foto, no puede ser negro": sin thumbs guardados, la
 * carátula pinta un frame real del video al vuelo (video oculto + canvas),
 * igual que la tira de escenas. Solo si TODO falla queda el placeholder.
 */

const mocks = vi.hoisted(() => ({
  thumbs: vi.fn(async () => ({ urls: [] as string[] })),
  preview: vi.fn(async () => ({ url: 'https://r2/preview.mp4' as string | null })),
}))
vi.mock('@/lib/actions/video-thumbs', () => ({ getPipelineVideoThumbViewUrls: mocks.thumbs }))
vi.mock('@/lib/actions/video-preview', () => ({ getVideoPreviewUrl: mocks.preview }))

describe('VideoCover fallback', () => {
  it('sin thumbs guardados monta el video oculto para pintar un frame real', async () => {
    mocks.thumbs.mockResolvedValueOnce({ urls: [] })
    mocks.preview.mockResolvedValueOnce({ url: 'https://r2/preview.mp4' })
    const { container } = render(<VideoCover videoId="v1" title="Intro" />)
    await waitFor(() => {
      const video = container.querySelector('video')
      expect(video).not.toBeNull()
      expect(video!.getAttribute('src')).toBe('https://r2/preview.mp4')
    })
  })

  it('con thumb guardado usa la imagen y NO monta video', async () => {
    mocks.thumbs.mockResolvedValueOnce({ urls: ['https://r2/t0.jpg'] })
    const { container } = render(<VideoCover videoId="v1" title="Intro" />)
    await waitFor(() => expect(screen.getByAltText('Carátula de Intro')).toBeInTheDocument())
    expect(container.querySelector('video')).toBeNull()
  })

  it('si todo falla queda el placeholder sin romper', async () => {
    mocks.thumbs.mockResolvedValueOnce({ urls: [] })
    mocks.preview.mockResolvedValueOnce({ url: null })
    render(<VideoCover videoId="v1" title="Intro" />)
    await waitFor(() => expect(screen.getByLabelText('Carátula no disponible')).toBeInTheDocument())
  })
})
