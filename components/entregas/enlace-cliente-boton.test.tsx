import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toast = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const getEnlaceCliente = vi.fn()
const crearEnlaceCliente = vi.fn()
vi.mock('@/lib/actions/entregas-client-review', () => ({
  getEnlaceCliente: (...a: unknown[]) => getEnlaceCliente(...(a as [])),
  crearEnlaceCliente: (...a: unknown[]) => crearEnlaceCliente(...(a as [])),
}))

const getEntregaVideoEditado = vi.fn()
const getEntregasDownloadUrl = vi.fn()
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregaVideoEditado: (...a: unknown[]) => getEntregaVideoEditado(...(a as [])),
  getEntregasDownloadUrl: (...a: unknown[]) => getEntregasDownloadUrl(...(a as [])),
}))

import { EnlaceClienteBoton } from './enlace-cliente-boton'

const ENLACE = {
  token: 'tok-123',
  expiresAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
  videos: [{ ideaId: 'i1', status: 'pending' as const, comment: null, reviewerName: null }],
}

function setup(over: Partial<React.ComponentProps<typeof EnlaceClienteBoton>> = {}) {
  return render(
    <EnlaceClienteBoton clientId="c1" clientName="Acme" ideaId="i1" {...over} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } })
  vi.spyOn(window, 'open').mockImplementation(() => null)
  getEnlaceCliente.mockResolvedValue({ enlace: null })
  getEntregaVideoEditado.mockResolvedValue({ id: null })
  getEntregasDownloadUrl.mockResolvedValue({ url: 'https://r2/get' })
})

describe('EnlaceClienteBoton — sin enlace generado', () => {
  it('solo muestra "Enlace cliente", sin Abrir ni Bajar', async () => {
    setup()
    await screen.findByRole('button', { name: /generar enlace de aprobación/i })
    expect(screen.queryByRole('link', { name: /abrir/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bajar/i })).not.toBeInTheDocument()
  })
})

describe('EnlaceClienteBoton — con enlace generado', () => {
  beforeEach(() => {
    getEnlaceCliente.mockResolvedValue({ enlace: ENLACE })
    getEntregaVideoEditado.mockResolvedValue({ id: 'v1' })
  })

  it('muestra los tres controles: copiar, abrir y bajar', async () => {
    setup()
    await screen.findByRole('button', { name: /copiar enlace/i })
    expect(screen.getByRole('link', { name: /abrir/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bajar/i })).toBeInTheDocument()
  })

  it('el clic en el texto copia el enlace y muestra el toast', async () => {
    setup()
    const copiar = await screen.findByRole('button', { name: /copiar enlace/i })
    fireEvent.click(copiar)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/aprobacion/tok-123')))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Enlace copiado' }))
  })

  it('"Abrir" apunta a /aprobacion/<token> en pestaña nueva con rel seguro', async () => {
    setup()
    const abrir = await screen.findByRole('link', { name: /abrir/i })
    expect(abrir).toHaveAttribute('href', '/aprobacion/tok-123')
    expect(abrir).toHaveAttribute('target', '_blank')
    expect(abrir).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('"Bajar" resuelve la URL del video editado vigente y la abre', async () => {
    setup()
    const bajar = await screen.findByRole('button', { name: /bajar/i })
    fireEvent.click(bajar)
    await waitFor(() => expect(getEntregasDownloadUrl).toHaveBeenCalledWith('v1'))
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://r2/get', '_blank'))
  })

  it('con error al bajar muestra un toast y no rompe la tarjeta', async () => {
    getEntregasDownloadUrl.mockResolvedValue({ error: 'No se pudo descargar' })
    setup()
    const bajar = await screen.findByRole('button', { name: /bajar/i })
    fireEvent.click(bajar)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(screen.getByRole('button', { name: /bajar/i })).toBeInTheDocument()
  })

  it('ningún clic propaga al contenedor de la tarjeta', async () => {
    const onCardClick = vi.fn()
    render(
      <div onClick={onCardClick}>
        <EnlaceClienteBoton clientId="c1" clientName="Acme" ideaId="i1" />
      </div>,
    )
    const copiar = await screen.findByRole('button', { name: /copiar enlace/i })
    fireEvent.click(copiar)
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('link', { name: /abrir/i }))
    fireEvent.click(screen.getByRole('button', { name: /bajar/i }))
    await waitFor(() => expect(getEntregasDownloadUrl).toHaveBeenCalled())
    expect(onCardClick).not.toHaveBeenCalled()
  })
})

describe('EnlaceClienteBoton — enlace generado sin video editado vigente', () => {
  it('no renderiza "Bajar" (no un botón muerto)', async () => {
    getEnlaceCliente.mockResolvedValue({ enlace: ENLACE })
    getEntregaVideoEditado.mockResolvedValue({ id: null })
    setup()
    await screen.findByRole('button', { name: /copiar enlace/i })
    expect(screen.queryByRole('button', { name: /bajar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /abrir/i })).toBeInTheDocument()
  })
})
