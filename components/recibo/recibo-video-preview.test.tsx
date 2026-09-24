import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getReciboIdeaPreviewUrl = vi.fn()

vi.mock('@/lib/actions/recibo', () => ({
  getReciboIdeaPreviewUrl: (...args: unknown[]) => getReciboIdeaPreviewUrl(...args),
}))

import { ReciboVideoPreview } from './recibo-video-preview'

describe('ReciboVideoPreview', () => {
  beforeEach(() => {
    getReciboIdeaPreviewUrl.mockReset()
  })

  it('carries the requested file to the server and displays a concurrent replacement error', async () => {
    getReciboIdeaPreviewUrl.mockResolvedValue({ error: 'El video cambió. Vuelve a cargar Recibo.' })
    render(<ReciboVideoPreview ideaId="outfit" hasEdited expectedVideoId="v7" />)
    await waitFor(() => expect(screen.getByTestId('recibo-video-error')).toHaveTextContent('El video cambió'))
    expect(getReciboIdeaPreviewUrl).toHaveBeenCalledWith('outfit', 'v7')
    expect(screen.queryByTestId('recibo-video-player')).not.toBeInTheDocument()
  })

  it('muestra vacío en español si no hay editado', () => {
    render(<ReciboVideoPreview ideaId="i1" hasEdited={false} />)
    expect(screen.getByTestId('recibo-video-empty')).toHaveTextContent('Sin video editado')
    expect(getReciboIdeaPreviewUrl).not.toHaveBeenCalled()
  })

  it('renderiza video con controls cuando hay URL', async () => {
    getReciboIdeaPreviewUrl.mockResolvedValue({ url: 'https://signed.example/edit.mp4' })
    render(<ReciboVideoPreview ideaId="i1" hasEdited={true} />)
    await waitFor(() => {
      const el = screen.getByTestId('recibo-video-player')
      expect(el).toBeInTheDocument()
      expect(el).toHaveAttribute('src', 'https://signed.example/edit.mp4')
      expect(el).toHaveAttribute('controls')
    })
    expect(getReciboIdeaPreviewUrl).toHaveBeenCalledWith('i1')
  })
})
