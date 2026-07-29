import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { UserRole } from '@/lib/supabase/types'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const publishIdeaToMetricool = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/idea-posting', () => ({
  publishIdeaToMetricool: (...a: unknown[]) => publishIdeaToMetricool(...(a as [])),
}))

let mockRole: UserRole | null = 'supervisor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))

import { PublishScheduleCard } from './publish-schedule-card'

/** The moment Metricool rejected the 10:00 post: 2026-07-29 11:05 AST. */
const NOW = new Date(Date.UTC(2026, 6, 29, 15, 5, 0))

beforeEach(() => {
  cleanup()
  mockRole = 'supervisor'
  publishIdeaToMetricool.mockClear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

function setup(over: Partial<React.ComponentProps<typeof PublishScheduleCard>> = {}) {
  return render(
    <PublishScheduleCard
      ideaIds={['i1']}
      publishDate="2026-07-29"
      postingTime="10:00"
      {...over}
    />,
  )
}

describe('PublishScheduleCard — la hora se puede cambiar antes de enviar', () => {
  it('muestra la fecha que Metricool va a recibir', () => {
    setup({ publishDate: '2026-08-03' })
    expect(screen.getByText(/Borrador en Metricool/i)).toBeInTheDocument()
    expect(screen.getByText(/3 ago 2026 · 10:00/i)).toBeInTheDocument()
  })

  it('avisa cuando la hora planificada ya pasó (el 400 de Metricool)', () => {
    setup()
    expect(screen.getByText(/ya pasó/i)).toBeInTheDocument()
  })

  it('abre un selector de fecha y hora con "Cambiar hora"', () => {
    setup()
    expect(screen.queryByLabelText(/fecha y hora/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    expect(screen.getByLabelText(/fecha y hora/i)).toBeInTheDocument()
  })

  it('propone el día siguiente cuando el turno de hoy ya pasó', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    expect(screen.getByLabelText(/fecha y hora/i)).toHaveValue('2026-07-30T10:00')
  })

  it('envía a Metricool la hora elegida, no la planificada', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), { target: { value: '2026-07-29T14:30' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar a metricool/i }))

    await waitFor(() => expect(publishIdeaToMetricool).toHaveBeenCalledWith('i1', '2026-07-29T14:30'))
  })

  it('refleja la hora elegida en la etiqueta del borrador', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), { target: { value: '2026-07-29T14:30' } })
    expect(screen.getByText(/29 jul 2026 · 14:30/i)).toBeInTheDocument()
    expect(screen.queryByText(/ya pasó/i)).not.toBeInTheDocument()
  })

  it('rechaza una hora pasada y no deja enviar', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), { target: { value: '2026-07-29T09:00' } })

    expect(screen.getByText(/ya pasó/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar a metricool/i })).toBeDisabled()
    expect(publishIdeaToMetricool).not.toHaveBeenCalled()
  })

  it('exige margen para que el video suba', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), { target: { value: '2026-07-29T11:07' } })
    expect(screen.getByText(/5 minutos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar a metricool/i })).toBeDisabled()
  })

  it('"Restaurar" vuelve a la hora planificada', async () => {
    setup({ publishDate: '2026-08-03' })
    fireEvent.click(screen.getByRole('button', { name: /cambiar hora/i }))
    fireEvent.change(screen.getByLabelText(/fecha y hora/i), { target: { value: '2026-08-04T18:00' } })
    expect(screen.getByText(/4 ago 2026 · 18:00/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /restaurar/i }))
    expect(screen.getByText(/3 ago 2026 · 10:00/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /enviar a metricool/i }))
    await waitFor(() => expect(publishIdeaToMetricool).toHaveBeenCalledWith('i1', undefined))
  })

  it('sin permiso de publicar no se ofrece cambiar la hora ni enviar', () => {
    mockRole = 'video'
    setup()
    expect(screen.queryByRole('button', { name: /cambiar hora/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar a metricool/i })).not.toBeInTheDocument()
    // La fecha sigue siendo informativa para todos.
    expect(screen.getByText(/Borrador en Metricool/i)).toBeInTheDocument()
  })

  it('avisa que la hora elegida aplica a todo el batch', () => {
    setup({ ideaIds: ['i1', 'i2', 'i3'] })
    expect(screen.getByText(/3 videos/i)).toBeInTheDocument()
  })
})
