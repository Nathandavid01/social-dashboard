import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const thumbs = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/video-thumbs', () => ({ getVideoThumbViewUrls: thumbs }))
import { ReciboThumbnail } from './recibo-thumbnail'
let intersect: (entries: { isIntersecting: boolean }[]) => void
beforeEach(() => {
  thumbs.mockReset()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersect) { intersect = callback }
    observe() {}
    disconnect() {}
  })
})
afterEach(() => vi.unstubAllGlobals())
describe('ReciboThumbnail', () => {
  it('fetches only a static image when visible, never a video', async () => {
    thumbs.mockResolvedValue({ urls: ['https://example.com/cover.jpg'] })
    const { container } = render(<ReciboThumbnail videoId="exact-cut" title="Mi reel" />)
    expect(thumbs).not.toHaveBeenCalled()
    intersect([{ isIntersecting: true }])
    expect(await screen.findByAltText('Miniatura de Mi reel')).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(thumbs).toHaveBeenCalledWith('exact-cut')
    expect(container.querySelector('video')).toBeNull()
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('Miniatura no disponible')).toBeInTheDocument()
  })
  it('handles unavailable thumbnails without requesting playback', async () => {
    thumbs.mockRejectedValue(new Error('offline'))
    const { container } = render(<ReciboThumbnail videoId="missing" title="Sin imagen" />)
    intersect([{ isIntersecting: true }])
    await waitFor(() => expect(screen.getByText('Miniatura no disponible')).toBeInTheDocument())
    expect(container.querySelector('video')).toBeNull()
  })
})


it('uses an existing Drive cover without requesting authenticated thumbs or playback', () => {
  const { container } = render(<ReciboThumbnail videoId="raw-drive" title="Crudo" coverUrl="https://drive.example/raw.jpg" />)
  expect(screen.getByAltText('Miniatura de Crudo')).toHaveAttribute('src', 'https://drive.example/raw.jpg')
  expect(screen.getByAltText('Miniatura de Crudo')).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(thumbs).not.toHaveBeenCalled()
  expect(container.querySelector('video')).toBeNull()
})

it('falls back to authenticated thumbnails if the existing cover cannot load', async () => {
  thumbs.mockResolvedValue({ urls: ['https://signed.example/thumb.jpg'] })
  render(<ReciboThumbnail videoId="raw-drive" title="Crudo" coverUrl="https://drive.example/broken.jpg" />)
  fireEvent.error(screen.getByRole('img'))
  intersect([{ isIntersecting: true }])
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'https://signed.example/thumb.jpg'))
  expect(thumbs).toHaveBeenCalledWith('raw-drive')
})
