import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { VideoSceneStrip } from './video-scene-strip'
import { getVideoThumbViewUrls } from '@/lib/actions/video-thumbs'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'

vi.mock('@/lib/actions/video-thumbs', () => ({
  getVideoThumbViewUrls: vi.fn(),
}))
vi.mock('@/lib/actions/video-preview', () => ({
  getVideoPreviewUrl: vi.fn(),
}))

async function flush() {
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VideoSceneStrip', () => {
  it('con thumb_keys guardados, renderiza 5 imágenes clicables', async () => {
    vi.mocked(getVideoThumbViewUrls).mockResolvedValue({
      urls: ['u0', 'u1', 'u2', 'u3', 'u4'],
    })
    render(<VideoSceneStrip videoId="vid-1" />)
    await flush()

    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(5)
    expect(imgs[0]).toHaveAttribute('src', 'u0')
  })

  it('sin thumb_keys y el preview también falla → no renderiza nada', async () => {
    vi.mocked(getVideoThumbViewUrls).mockResolvedValue({ urls: [] })
    vi.mocked(getVideoPreviewUrl).mockResolvedValue({ error: 'no encontrado' })
    const { container } = render(<VideoSceneStrip videoId="vid-2" />)
    await flush()

    expect(container).toBeEmptyDOMElement()
  })

  it('mientras carga muestra el skeleton', async () => {
    let resolve!: (v: { urls: string[] }) => void
    vi.mocked(getVideoThumbViewUrls).mockReturnValue(new Promise((r) => { resolve = r }))
    render(<VideoSceneStrip videoId="vid-3" />)

    expect(screen.getByTestId('scene-strip-skeleton')).toBeInTheDocument()

    await act(async () => { resolve({ urls: [] }) })
  })

  it('getVideoThumbViewUrls lanza → cae al fallback (preview) sin romper', async () => {
    vi.mocked(getVideoThumbViewUrls).mockRejectedValue(new Error('boom'))
    vi.mocked(getVideoPreviewUrl).mockResolvedValue({ error: 'no encontrado' })
    const { container } = render(<VideoSceneStrip videoId="vid-4" />)
    await flush()
    expect(container).toBeEmptyDOMElement()
  })

  it('con urls guardadas, click en una imagen dispara onOpen', async () => {
    vi.mocked(getVideoThumbViewUrls).mockResolvedValue({ urls: ['u0'] })
    const onOpen = vi.fn()
    render(<VideoSceneStrip videoId="vid-5" onOpen={onOpen} />)
    await flush()

    const img = screen.getByRole('img')
    img.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onOpen).toHaveBeenCalled()
  })
})
