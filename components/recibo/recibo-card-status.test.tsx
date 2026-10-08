import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

const setManualPostedStatus = vi.fn()
const publishReciboOnCadence = vi.fn()
const cancelReciboSchedule = vi.fn()
const refresh = vi.fn()
const toast = vi.fn(() => ({ dismiss: vi.fn() }))

vi.mock('@/lib/actions/recibo', () => ({
  setManualPostedStatus: (...a: unknown[]) => setManualPostedStatus(...a),
  setStaffClientApproval: vi.fn(),
}))
vi.mock('@/lib/actions/entregas-client-review', () => ({ crearEnlaceCliente: vi.fn() }))
vi.mock('@/lib/actions/recibo-publish', () => ({
  publishReciboOnCadence: (...a: unknown[]) => publishReciboOnCadence(...a),
  cancelReciboSchedule: (...a: unknown[]) => cancelReciboSchedule(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => true,
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { ReciboPublishButton, ReciboStatusMarks } from './recibo-card-status'

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
    // Si la tarjeta sigue en pantalla, la marca vuelve a quedar disponible.
    expect(screen.getAllByRole('button', { name: 'Publicado' })[0]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('button', { name: 'Publicado' })[0]).toBeEnabled()
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

const cadence = {
  postingDays: [3, 5],
  postingTime: '18:00',
  postingSchedule: null as Record<string, string> | null,
  metricool: true,
}

describe('ReciboPublishButton — programar el espacio', () => {
  it('dice Programar para la fecha del espacio', () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    expect(screen.getByRole('button', { name: /Programar para/i })).toHaveTextContent(/miércoles 7 de octubre/i)
  })

  it('al confirmar llama a schedule con esa fecha y queda Programado', async () => {
    publishReciboOnCadence.mockResolvedValue({ ok: true, label: 'miércoles 7 de octubre, 6:00 p.m.' })
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Programar para/i }))
    await waitFor(() => expect(publishReciboOnCadence).toHaveBeenCalledWith('i1', '2026-10-07'))
    expect(await screen.findByText(/Programado miércoles 7 de octubre/i)).toBeInTheDocument()
  })

  it('si el espacio ya pasó, avisa y no programa hasta que elijan otra fecha', async () => {
    publishReciboOnCadence.mockResolvedValue({ ok: true, label: 'viernes 9 de octubre, 6:00 p.m.' })
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-04"
        spaceDateISO="2026-09-28"
        cadence={cadence}
        editMode="ai"
      />,
    )
    expect(screen.getByText(/ya pasó/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Programar/i })).toBeDisabled()
    expect(publishReciboOnCadence).not.toHaveBeenCalled()
    const field = screen.getByLabelText('Nueva fecha')
    await userEvent.clear(field)
    await userEvent.type(field, '2026-10-09')
    await userEvent.click(screen.getByRole('button', { name: /Programar para/i }))
    await waitFor(() => expect(publishReciboOnCadence).toHaveBeenCalledWith('i1', '2026-10-09'))
  })

  it('si el espacio es hoy y la hora ya pasó, avisa y pide otra fecha', () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-04"
        spaceDateISO="2026-10-04"
        nowMs={Date.parse('2026-10-04T20:00:00-04:00')}
        cadence={{ ...cadence, postingDays: [0], postingTime: '09:00' }}
        editMode="ai"
      />,
    )
    expect(screen.getByText(/ya pasó/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Programar/i })).toBeDisabled()
    expect(publishReciboOnCadence).not.toHaveBeenCalled()
  })
})

describe('ReciboPublishButton — ya programado', () => {
  it('muestra Programado, Cambiar fecha y Cancelar programación', () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        scheduled
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    expect(screen.getByText(/Programado miércoles 7 de octubre/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cambiar fecha/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelar programación/i })).toBeInTheDocument()
  })

  it('cambiar fecha reprograma a otra fecha futura', async () => {
    publishReciboOnCadence.mockResolvedValue({ ok: true, label: 'viernes 9 de octubre, 6:00 p.m.' })
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        scheduled
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Cambiar fecha/i }))
    await userEvent.type(screen.getByLabelText('Nueva fecha'), '2026-10-09')
    await userEvent.click(screen.getByRole('button', { name: /Guardar nueva fecha/i }))
    await waitFor(() => expect(publishReciboOnCadence).toHaveBeenCalledWith('i1', '2026-10-09'))
    expect(await screen.findByText(/Programado viernes 9 de octubre/i)).toBeInTheDocument()
  })

  it('cancelar pide confirmación, borra el post y vuelve a no programado', async () => {
    cancelReciboSchedule.mockResolvedValue({ ok: true, deleted: true })
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        scheduled
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Cancelar programación/i }))
    expect(cancelReciboSchedule).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Sí, cancelar/i }))
    await waitFor(() => expect(cancelReciboSchedule).toHaveBeenCalledWith('i1'))
    expect(await screen.findByRole('button', { name: /Programar para/i })).toBeInTheDocument()
  })

  it('no reprograma a una fecha ya pasada', async () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        scheduled
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="ai"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Cambiar fecha/i }))
    await userEvent.type(screen.getByLabelText('Nueva fecha'), '2026-09-28')
    expect(screen.getByRole('button', { name: /Guardar nueva fecha/i })).toBeDisabled()
    expect(publishReciboOnCadence).not.toHaveBeenCalled()
  })
})

describe('ReciboPublishButton — cadencia incompleta (AI)', () => {
  it('no muestra NaN si la hora guardada es reel', () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-06"
        cadence={{ ...cadence, postingDays: [2], postingTime: 'reel' }}
        editMode="ai"
      />,
    )
    expect(document.body.textContent).not.toMatch(/NaN/)
    expect(screen.queryByRole('button', { name: /12:NaN/i })).not.toBeInTheDocument()
  })

  it('pide fecha y hora a mano y prellena el próximo día de cadencia', async () => {
    publishReciboOnCadence.mockResolvedValue({ ok: true, label: 'martes 6 de octubre, 11:19 a.m.' })
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-06"
        cadence={{ ...cadence, postingDays: [2], postingTime: null }}
        editMode="ai"
      />,
    )
    expect(screen.getByText(/no tiene hora de publicación; escógela aquí/i)).toBeInTheDocument()
    const dateField = screen.getByLabelText(/fecha/i)
    expect(dateField).toHaveValue('2026-10-06')
    const timeField = screen.getByLabelText(/hora/i)
    await userEvent.clear(timeField)
    await userEvent.type(timeField, '11:19')
    await userEvent.click(screen.getByRole('button', { name: /Programar/i }))
    await waitFor(() => expect(publishReciboOnCadence).toHaveBeenCalledWith('i1', '2026-10-06', '11:19'))
  })
})

describe('ReciboPublishButton — cliente no-AI', () => {
  it('muestra la nota y no un botón que programe', async () => {
    render(
      <ReciboPublishButton
        ideaId="i1"
        approved
        todayISO="2026-10-04"
        spaceDateISO="2026-10-07"
        cadence={cadence}
        editMode="human"
      />,
    )
    expect(screen.getByText(/Solo clientes AI se programan desde Recibo/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Programar/i })).not.toBeInTheDocument()
    expect(publishReciboOnCadence).not.toHaveBeenCalled()
  })
})
