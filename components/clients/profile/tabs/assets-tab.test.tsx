import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const addClientAssetLink = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/actions/client-asset-links', () => ({ addClientAssetLink: (...a: unknown[]) => addClientAssetLink(...(a as [])) }))
vi.mock('@/lib/actions/client-profile', () => ({ uploadClientAsset: vi.fn(), deleteClientAsset: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { AssetsTab } from './assets-tab'

beforeEach(() => addClientAssetLink.mockClear())

describe('AssetsTab — enlaces externos (dónde están los B-rolls y los logos)', () => {
  it('permite añadir un enlace con nombre y URL', async () => {
    render(<AssetsTab clientId="c1" assets={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /añadir enlace/i }))
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'B-rolls en Drive' } })
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'https://drive.google.com/drive/folders/abc' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar enlace/i }))
    await waitFor(() => expect(addClientAssetLink).toHaveBeenCalledWith('c1', { name: 'B-rolls en Drive', url: 'https://drive.google.com/drive/folders/abc', kind: 'other' }))
  })

  it('un activo-enlace se muestra con su nombre y abre en otra pestaña', () => {
    render(<AssetsTab clientId="c1" assets={[{ id: 'a1', client_id: 'c1', kind: 'other', name: 'B-rolls en Drive', url: 'https://drive.google.com/x', storage_path: null, size_bytes: null, mime_type: null, uploaded_by: null, uploaded_at: '2026-09-02' }]} />)
    expect(screen.getByText('B-rolls en Drive')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /abrir/i })).toHaveAttribute('href', 'https://drive.google.com/x')
  })
})
