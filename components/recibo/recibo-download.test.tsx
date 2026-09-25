import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const getReciboIdeaDownloadUrl = vi.fn()
const toast = vi.fn()

vi.mock('@/lib/actions/recibo', () => ({
  getReciboIdeaDownloadUrl: (...args: unknown[]) => getReciboIdeaDownloadUrl(...args),
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}))

import { ReciboDownloadButton } from './recibo-download'

let clicked: string[] = []

beforeEach(() => {
  getReciboIdeaDownloadUrl.mockReset()
  toast.mockReset()
  clicked = []
  // jsdom no navega: capturamos el enlace que el botón "hace clic" por nosotros.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.href)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  render(<ReciboDownloadButton ideaId="outfit" videoId="v7" title="Outfit" />)
  return screen.getByRole('button', { name: 'Bajar Outfit' })
}

describe('ReciboDownloadButton', () => {
  it('baja el corte que muestra la tarjeta', async () => {
    getReciboIdeaDownloadUrl.mockResolvedValue({ url: 'https://signed.example/v7.mp4?dl=1' })
    await userEvent.click(setup())
    await waitFor(() => expect(clicked).toEqual(['https://signed.example/v7.mp4?dl=1']))
    expect(getReciboIdeaDownloadUrl).toHaveBeenCalledWith('outfit', 'v7')
    expect(toast).not.toHaveBeenCalled()
    // El enlace temporal no se queda en la página.
    expect(document.querySelectorAll('a[href="https://signed.example/v7.mp4?dl=1"]')).toHaveLength(0)
  })

  it('avisa en español si el servidor no da el enlace, y no descarga nada', async () => {
    getReciboIdeaDownloadUrl.mockResolvedValue({ error: 'El video cambió. Vuelve a cargar Recibo.' })
    await userEvent.click(setup())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No se pudo bajar',
          description: 'El video cambió. Vuelve a cargar Recibo.',
          variant: 'destructive',
        }),
      ),
    )
    expect(clicked).toEqual([])
    expect(screen.getByRole('button', { name: 'Bajar Outfit' })).toBeEnabled()
  })

  it('avisa si falla la red', async () => {
    getReciboIdeaDownloadUrl.mockRejectedValue(new Error('network'))
    await userEvent.click(setup())
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(clicked).toEqual([])
  })

  it('un doble toque no pide dos descargas', async () => {
    let resolve!: (v: { url: string }) => void
    getReciboIdeaDownloadUrl.mockReturnValue(new Promise((r) => { resolve = r }))
    const button = setup()
    await userEvent.click(button)
    await userEvent.click(button)
    expect(button).toBeDisabled()
    resolve({ url: 'https://signed.example/v7.mp4' })
    await waitFor(() => expect(button).toBeEnabled())
    expect(getReciboIdeaDownloadUrl).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
  })
})
