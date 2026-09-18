import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ClientBankFile } from '@/lib/utils/client-asset-bank'

const putBankFile = vi.fn(async (_input: { clientId: string; kind: string; file: File }) => ({} as { error?: string }))
const getClientAssetDownloadUrl = vi.fn(async (_id: string) => ({ url: 'https://signed.example/file' }))

vi.mock('@/components/clients/put-bank-file', () => ({
  putBankFile: (input: { clientId: string; kind: string; file: File }) => putBankFile(input),
}))
vi.mock('@/lib/actions/client-asset-bank', () => ({
  getClientAssetDownloadUrl: (id: string) => getClientAssetDownloadUrl(id),
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { ClientAssetBankPanel } from './client-asset-bank-panel'

const file = (over: Partial<ClientBankFile> = {}): ClientBankFile => ({
  id: 'a1',
  clientId: 'c1',
  name: 'Logo principal.png',
  kind: 'logo',
  url: 'https://x/logo.png',
  storagePath: 'client-assets/c1/logo.png',
  sizeBytes: 1200,
  mimeType: 'image/png',
  ...over,
})

beforeEach(() => {
  putBankFile.mockReset().mockResolvedValue({})
  getClientAssetDownloadUrl.mockReset().mockResolvedValue({ url: 'https://signed.example/file' })
})

describe('ClientAssetBankPanel', () => {
  it('muestra el banco del cliente con etiquetas en español', () => {
    render(
      <ClientAssetBankPanel
        clientId="c1"
        clientName="Blue Chiropractic"
        assets={[file(), file({ id: 'a2', name: 'Patio.mp4', kind: 'broll' })]}
        canUpload
      />,
    )
    expect(screen.getByRole('heading', { name: /banco del cliente/i })).toBeInTheDocument()
    expect(screen.getByText('Logo principal.png')).toBeInTheDocument()
    expect(screen.getByText('Patio.mp4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B-roll' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Otro' })).toBeInTheDocument()
  })

  it('no inventa archivos cuando el banco está vacío', () => {
    render(
      <ClientAssetBankPanel
        clientId="c1"
        clientName="Blue Chiropractic"
        assets={[]}
        canUpload
      />,
    )
    expect(screen.getByText(/todavía no hay archivos en el banco/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('sube al banco del cliente, no a una idea', async () => {
    const user = userEvent.setup()
    render(
      <ClientAssetBankPanel
        clientId="c1"
        clientName="Blue Chiropractic"
        assets={[]}
        canUpload
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Foto' }))
    const input = screen.getByLabelText('Subir al banco') as HTMLInputElement
    const photo = new File(['img'], 'sala.jpg', { type: 'image/jpeg' })
    await user.upload(input, photo)
    await waitFor(() => expect(putBankFile).toHaveBeenCalledWith({
      clientId: 'c1',
      kind: 'photo',
      file: photo,
    }))
  })

  it('sin permiso de subida se ve el banco pero no el input', () => {
    render(
      <ClientAssetBankPanel
        clientId="c1"
        clientName="Blue Chiropractic"
        assets={[file()]}
        canUpload={false}
      />,
    )
    expect(screen.getByText('Logo principal.png')).toBeInTheDocument()
    expect(screen.queryByLabelText('Subir al banco')).not.toBeInTheDocument()
  })
})
