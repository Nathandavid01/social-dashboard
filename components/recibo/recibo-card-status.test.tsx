import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

const setManualPostedStatus = vi.fn()
const refresh = vi.fn()
const toast = vi.fn((..._a: unknown[]) => ({ dismiss: vi.fn() }))

vi.mock('@/lib/actions/recibo', () => ({
  setManualPostedStatus: (...a: unknown[]) => setManualPostedStatus(...a),
  setStaffClientApproval: vi.fn(),
}))
vi.mock('@/lib/actions/entregas-client-review', () => ({ crearEnlaceCliente: vi.fn() }))
vi.mock('@/lib/actions/recibo-publish', () => ({ publishReciboOnCadence: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { ReciboStatusMarks } from './recibo-card-status'

function renderMarks(postedStatus: 'not_posted' | null = null) {
  render(<ReciboStatusMarks ideaId="i1" clientId="c1" approved={false} sent={false} postedStatus={postedStatus} />)
  return screen.getByRole('button', { name: 'Publicado' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReciboStatusMarks — Publicado', () => {
  it('la tarjeta tiene la marca Publicado junto a Enviado y Aprobado', () => {
    renderMarks()
    expect(screen.getByRole('button', { name: 'Enviado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicado' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('se enciende al instante y no se puede tocar dos veces mientras guarda', async () => {
    let resolve!: (v: { ok: true }) => void
    setManualPostedStatus.mockReturnValue(new Promise((r) => { resolve = r }))
    const mark = renderMarks()
    await userEvent.click(mark)
    expect(mark).toHaveAttribute('aria-pressed', 'true')
    expect(mark).toBeDisabled()
    await userEvent.click(mark)
    resolve({ ok: true })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(setManualPostedStatus).toHaveBeenCalledTimes(1)
  })

  it('marcarlo lo da por publicado y Recibo se recarga sin él', async () => {
    setManualPostedStatus.mockResolvedValue({ ok: true })
    await userEvent.click(renderMarks())
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(setManualPostedStatus).toHaveBeenCalledWith({ ideaId: 'i1', status: 'posted' })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Marcado como publicado' }))
  })

  it('un toque por error se deshace desde el aviso', async () => {
    setManualPostedStatus.mockResolvedValue({ ok: true })
    await userEvent.click(renderMarks())
    await waitFor(() => expect(toast).toHaveBeenCalled())
    const action = (toast.mock.calls[0][0] as { action: ReactElement }).action
    render(action)
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(setManualPostedStatus).toHaveBeenLastCalledWith({ ideaId: 'i1', status: null }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  })

  it('Deshacer devuelve el estado que tenía (no lo borra)', async () => {
    setManualPostedStatus.mockResolvedValue({ ok: true })
    await userEvent.click(renderMarks('not_posted'))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    render((toast.mock.calls[0][0] as { action: ReactElement }).action)
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(setManualPostedStatus).toHaveBeenLastCalledWith({ ideaId: 'i1', status: 'not_posted' }))
  })

  it('si falla, avisa y la tarjeta se queda', async () => {
    setManualPostedStatus.mockResolvedValue({ error: 'No autorizado' })
    const mark = renderMarks()
    await userEvent.click(mark)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se pudo marcar como publicado',
      description: 'No autorizado',
      variant: 'destructive',
    })))
    expect(refresh).not.toHaveBeenCalled()
    expect(mark).toHaveAttribute('aria-pressed', 'false')
  })
})
