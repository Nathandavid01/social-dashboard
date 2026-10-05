import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReciboFeedback } from './recibo-feedback'

const addReciboInternalNote = vi.fn()
const listReciboInternalNotes = vi.fn()

vi.mock('@/lib/actions/recibo-internal-notes', () => ({
  addReciboInternalNote: (...a: unknown[]) => addReciboInternalNote(...a),
  listReciboInternalNotes: (...a: unknown[]) => listReciboInternalNotes(...a),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

let canWrite = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: (perm: string) => (perm === 'entregas.read' ? canWrite : false),
}))

describe('ReciboFeedback', () => {
  beforeEach(() => {
    canWrite = true
    addReciboInternalNote.mockReset().mockResolvedValue({ ok: true })
    listReciboInternalNotes.mockReset().mockResolvedValue([])
  })
  afterEach(() => cleanup())

  it('muestra el cuadro interno para decir por qué no les gusta el video', async () => {
    render(<ReciboFeedback ideaId="i1" />)
    expect(await screen.findByRole('textbox', { name: /por qué no te gusta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar motivo/i })).toBeInTheDocument()
    expect(screen.getByText(/no me gusta/i)).toBeInTheDocument()
    expect(screen.getByText(/solo el equipo/i)).toBeInTheDocument()
  })

  it('guarda el motivo en notas internas de Recibo', async () => {
    const user = userEvent.setup()
    render(<ReciboFeedback ideaId="i1" />)
    const box = await screen.findByRole('textbox', { name: /por qué no te gusta/i })
    await user.type(box, 'El corte se ve oscuro')
    await user.click(screen.getByRole('button', { name: /guardar motivo/i }))
    await waitFor(() => {
      expect(addReciboInternalNote).toHaveBeenCalledWith('i1', 'El corte se ve oscuro')
    })
  })

  it('muestra solo el hilo interno, nunca comentarios del cliente', async () => {
    listReciboInternalNotes.mockResolvedValue([
      {
        id: 'n1',
        author_name: 'Eric Perez',
        body: 'El hook no se entiende',
        created_at: '2026-10-05T12:00:00Z',
      },
    ])
    render(<ReciboFeedback ideaId="i1" />)
    expect(await screen.findByText('El hook no se entiende')).toBeInTheDocument()
    expect(screen.getByText('Equipo')).toBeInTheDocument()
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument()
    expect(screen.queryByText('Bajen un poco el volumen')).not.toBeInTheDocument()
  })

  it('sin entregas.read muestra el hilo pero no el formulario', async () => {
    canWrite = false
    listReciboInternalNotes.mockResolvedValue([
      {
        id: 'n1',
        author_name: 'Eric Perez',
        body: 'El hook no se entiende',
        created_at: '2026-10-05T12:00:00Z',
      },
    ])
    render(<ReciboFeedback ideaId="i1" />)
    expect(await screen.findByText('El hook no se entiende')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /por qué no te gusta/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar motivo/i })).not.toBeInTheDocument()
  })

  it('no envía un motivo vacío', async () => {
    const user = userEvent.setup()
    render(<ReciboFeedback ideaId="i1" />)
    await screen.findByRole('textbox', { name: /por qué no te gusta/i })
    await user.click(screen.getByRole('button', { name: /guardar motivo/i }))
    expect(addReciboInternalNote).not.toHaveBeenCalled()
  })
})
