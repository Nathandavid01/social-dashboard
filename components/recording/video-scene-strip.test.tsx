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

  // Camino "live" (fallback al vuelo): el canvas real / seek de <video> no son
  // testeables en jsdom, pero SÍ el guard de duración degenerada — es el mismo
  // chequeo (Number.isFinite(duration) && duration > 0) que hace que
  // frameTimestamps() devuelva [] para Infinity/0 en video-frames.test.ts.
  describe('camino "live" — duración degenerada (webm/MediaRecorder)', () => {
    it('duration === Infinity → cae a \'none\' (no se queda pintando canvases vacíos)', async () => {
      vi.mocked(getVideoThumbViewUrls).mockResolvedValue({ urls: [] })
      vi.mocked(getVideoPreviewUrl).mockResolvedValue({ url: 'https://r2/preview.mp4', provider: 'r2' })
      const { container } = render(<VideoSceneStrip videoId="vid-6" />)
      await flush()

      // Estado 'live': el <video> oculto ya está montado con el preview.
      const video = container.querySelector('video') as HTMLVideoElement
      expect(video).toBeTruthy()

      Object.defineProperty(video, 'duration', { value: Infinity, configurable: true })
      await act(async () => { video.dispatchEvent(new Event('loadedmetadata')) })

      // Duración no finita → ningún timestamp que pintar → el componente
      // se rinde a 'none' en vez de dejar 5 <canvas> vacíos para siempre.
      expect(container).toBeEmptyDOMElement()
    })

    it('readyState ya en HAVE_METADATA antes del efecto (carrera) no cuelga esperando el evento', async () => {
      vi.mocked(getVideoThumbViewUrls).mockResolvedValue({ urls: [] })
      vi.mocked(getVideoPreviewUrl).mockResolvedValue({ url: 'https://r2/preview.mp4', provider: 'r2' })

      // Simula que 'loadedmetadata' YA disparó antes de que el efecto
      // conectara el listener: readyState alto, sin evento por venir.
      const proto = HTMLMediaElement.prototype
      const original = Object.getOwnPropertyDescriptor(proto, 'readyState')
      Object.defineProperty(proto, 'readyState', { configurable: true, get: () => 1 })

      try {
        const { container } = render(<VideoSceneStrip videoId="vid-7" />)
        await flush()
        // jsdom's default video.duration es NaN → falla el guard de duración
        // igual, pero sin depender de esperar 'loadedmetadata' — si el
        // readyState check no existiera, esto se quedaría colgado en 'live'
        // con 5 canvases vacíos hasta el timeout de 10s.
        expect(container).toBeEmptyDOMElement()
      } finally {
        if (original) Object.defineProperty(proto, 'readyState', original)
      }
    })
  })
})
