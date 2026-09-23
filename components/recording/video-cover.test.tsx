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

const healMock = vi.hoisted(() => ({ healVideoCover: vi.fn() }))
vi.mock('@/lib/utils/video-cover-heal', () => ({ healVideoCover: healMock.healVideoCover }))

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

  // 27 de 134 crudos en prod no tenían carátula y nada la recuperaba.
  it('en el banco de crudos (healMissing), sin carátula guardada: la genera, la guarda y la pinta', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({ urls: [] })
    healMock.healVideoCover.mockResolvedValue('data:image/jpeg;base64,CURADA')

    render(<VideoCover videoId="video-3" title="Crudo Pastrami" healMissing />)

    const cover = await screen.findByRole('img', { name: 'Carátula de Crudo Pastrami' })
    expect(cover).toHaveAttribute('src', 'data:image/jpeg;base64,CURADA')
    expect(healMock.healVideoCover).toHaveBeenCalledWith('video-3')
    expect(actionMocks.getVideoPreviewUrl).not.toHaveBeenCalled()
  })

  it('si no se pudo curar, cae al frame al vuelo como antes', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({ urls: [] })
    actionMocks.getVideoPreviewUrl.mockResolvedValue({ url: 'https://cdn.example/video.mp4' })
    healMock.healVideoCover.mockResolvedValue(null)

    render(<VideoCover videoId="video-4" title="Crudo" healMissing />)

    await waitFor(() => expect(actionMocks.getVideoPreviewUrl).toHaveBeenCalledWith('video-4'))
  })

  it('fuera del banco de crudos no intenta curar (no se bajan los 224 editados sin tira)', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({ urls: [] })
    actionMocks.getVideoPreviewUrl.mockResolvedValue({ url: 'https://cdn.example/video.mp4' })

    render(<VideoCover videoId="video-5" title="Editado" />)

    await waitFor(() => expect(actionMocks.getVideoPreviewUrl).toHaveBeenCalledWith('video-5'))
    expect(healMock.healVideoCover).not.toHaveBeenCalled()
  })

  it('con carátula guardada no toca la curación', async () => {
    actionMocks.getPipelineVideoThumbViewUrls.mockResolvedValue({ urls: ['https://cdn.example/f.jpg'] })

    render(<VideoCover videoId="video-6" title="Con carátula" healMissing />)

    await screen.findByRole('img', { name: 'Carátula de Con carátula' })
    expect(healMock.healVideoCover).not.toHaveBeenCalled()
  })
})
