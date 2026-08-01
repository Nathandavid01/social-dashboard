import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./submit-video-card', () => ({
  SubmitVideoCard: () => <div data-testid="form" />,
  MAX_VIDEO_BYTES: 5 * 1024 * 1024 * 1024,
}))
vi.mock('./use-submit-videos', () => ({
  useSubmitVideos: () => ({ submit: vi.fn(), rows: [], running: false, clear: vi.fn() }),
}))

import { EditorSubmitSlot } from './editor-submit-slot'
import { fechaDeEntrega } from '@/lib/entregas/dias'

const clientes = [{ id: 'c1', name: 'Kavanna' }]

function fechaEsperada(dia: 1 | 2 | 6, semana: number): string {
  const iso = fechaDeEntrega(dia, undefined, semana)
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

describe('EditorSubmitSlot — el rótulo de entrega', () => {
  it('dice el día en que se publica, no el de la pestaña', () => {
    render(<EditorSubmitSlot clients={clientes} dia={1} />)
    expect(screen.getByText(/Entregando para/)).toHaveTextContent('Martes')
  })

  /**
   * Trabajando adelantado, el nombre del día no distingue una semana de la
   * siguiente: "Martes" es igual de cierto para el 4 y para el 11 de agosto.
   */
  it('lleva la fecha, no solo el nombre del día', () => {
    render(<EditorSubmitSlot clients={clientes} dia={1} semanaOffset={0} />)
    expect(screen.getByText(/Entregando para/)).toHaveTextContent(fechaEsperada(1, 0))
  })

  it('la fecha cambia al adelantar de semana', () => {
    const { unmount } = render(<EditorSubmitSlot clients={clientes} dia={1} semanaOffset={0} />)
    const estaSemana = screen.getByText(/Entregando para/).textContent
    unmount()

    render(<EditorSubmitSlot clients={clientes} dia={1} semanaOffset={1} />)
    const proxima = screen.getByText(/Entregando para/).textContent
    expect(proxima).not.toBe(estaSemana)
    expect(proxima).toContain(fechaEsperada(1, 1))
  })

  it('el sábado publica el lunes, y lo dice con su fecha', () => {
    render(<EditorSubmitSlot clients={clientes} dia={6} semanaOffset={0} />)
    const t = screen.getByText(/Entregando para/)
    expect(t).toHaveTextContent('Lunes')
    expect(t).toHaveTextContent(fechaEsperada(6, 0))
  })
})
