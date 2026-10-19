import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const getVideoDownloadUrl = vi.fn()
const toast = vi.fn()

vi.mock('@/lib/actions/video-download', () => ({
  getVideoDownloadUrl: (...args: unknown[]) => getVideoDownloadUrl(...args),
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}))

import { VideoDownloadButton } from './video-download-button'

let clicked: string[] = []

beforeEach(() => {
  getVideoDownloadUrl.mockReset()
  toast.mockReset()
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.href)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('VideoDownloadButton', () => {
  it('baja el archivo firmado del video, sin pasar por Recibo', async () => {
    getVideoDownloadUrl.mockResolvedValue({ url: 'https://signed.example/v2.mp4' })
    render(<VideoDownloadButton videoId="v2" title="Así se prepara" />)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Así se prepara' }))
    await waitFor(() => expect(clicked).toEqual(['https://signed.example/v2.mp4']))
    expect(getVideoDownloadUrl).toHaveBeenCalledWith('v2')
    expect(toast).not.toHaveBeenCalled()
  })

  it('avisa en español si no hay archivo descargable', async () => {
    getVideoDownloadUrl.mockResolvedValue({ error: 'Este video no tiene un archivo descargable.' })
    render(<VideoDownloadButton videoId="missing" title="Sin archivo" />)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Sin archivo' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No se pudo bajar',
          description: 'Este video no tiene un archivo descargable.',
          variant: 'destructive',
        }),
      ),
    )
    expect(clicked).toEqual([])
  })
})
