import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const reveal = vi.fn()
const save = vi.fn()
const remove = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/client-credentials', () => ({
  revealClientCredentialPassword: (...a: unknown[]) => reveal(...a),
  saveClientCredential: (...a: unknown[]) => save(...a),
  deleteClientCredential: (...a: unknown[]) => remove(...a),
}))

import { AccessTab } from './access-tab'

const rows = [
  { id: 'k1', platform: 'instagram' as const, username: '@cafe', notes: null, updated_at: '2026-10-20T00:00:00Z', has_password: true },
]

beforeEach(() => {
  reveal.mockReset().mockResolvedValue({ password: 'S3creta!' })
  save.mockReset().mockResolvedValue({ ok: true, id: 'k2' })
  remove.mockReset().mockResolvedValue({ ok: true })
})

describe('AccessTab', () => {
  it('muestra la red y el usuario, con la contraseña oculta', () => {
    render(<AccessTab clientId="c1" initial={rows} canEdit keyConfigured />)
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('@cafe')).toBeInTheDocument()
    expect(screen.queryByText('S3creta!')).not.toBeInTheDocument()
    expect(reveal).not.toHaveBeenCalled()
  })

  it('«Mostrar» pide la contraseña al servidor y la enseña', async () => {
    render(<AccessTab clientId="c1" initial={rows} canEdit keyConfigured />)
    fireEvent.click(screen.getByRole('button', { name: /Mostrar contraseña de Instagram/i }))
    await waitFor(() => expect(screen.getByText('S3creta!')).toBeInTheDocument())
    expect(reveal).toHaveBeenCalledWith('k1')
    fireEvent.click(screen.getByRole('button', { name: /Ocultar contraseña de Instagram/i }))
    expect(screen.queryByText('S3creta!')).not.toBeInTheDocument()
  })

  it('agrega un acceso nuevo con red, usuario y contraseña', async () => {
    render(<AccessTab clientId="c1" initial={[]} canEdit keyConfigured />)
    expect(screen.getByText(/Todavía no hay accesos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Agregar acceso/i }))
    fireEvent.change(screen.getByLabelText('Red'), { target: { value: 'tiktok' } })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'cafe.pr' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ clientId: 'c1', platform: 'tiktok', username: 'cafe.pr', password: 'nueva', notes: '' }),
    )
    await waitFor(() => expect(screen.getByText('cafe.pr')).toBeInTheDocument())
  })

  it('sin permiso de edición no muestra agregar, editar ni borrar', () => {
    render(<AccessTab clientId="c1" initial={rows} canEdit={false} keyConfigured />)
    expect(screen.queryByRole('button', { name: /Agregar acceso/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Borrar/i })).not.toBeInTheDocument()
  })

  it('sin llave de cifrado avisa y no deja agregar', () => {
    render(<AccessTab clientId="c1" initial={[]} canEdit keyConfigured={false} />)
    expect(screen.getByText(/CLIENT_CREDENTIALS_KEY/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Agregar acceso/i })).not.toBeInTheDocument()
  })
})
