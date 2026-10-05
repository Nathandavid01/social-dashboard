import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReciboFeedback } from './recibo-feedback'

const addStaffReviewComment = vi.fn()
const getReciboReviewComments = vi.fn()

vi.mock('@/lib/actions/review-staff', () => ({
  addStaffReviewComment: (...a: unknown[]) => addStaffReviewComment(...a),
  getReciboReviewComments: (...a: unknown[]) => getReciboReviewComments(...a),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

let canMove = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: (perm: string) => (perm === 'planning.move' ? canMove : false),
}))

describe('ReciboFeedback', () => {
  beforeEach(() => {
    canMove = true
    addStaffReviewComment.mockReset().mockResolvedValue({ ok: true })
    getReciboReviewComments.mockReset().mockResolvedValue([])
  })
  afterEach(() => cleanup())

  it('muestra el cuadro para decir por qué no les gusta el video', async () => {
    render(<ReciboFeedback ideaId="i1" />)
    expect(await screen.findByRole('textbox', { name: /por qué no te gusta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar motivo/i })).toBeInTheDocument()
    expect(screen.getByText(/no me gusta/i)).toBeInTheDocument()
  })

  it('guarda el motivo con addStaffReviewComment', async () => {
    const user = userEvent.setup()
    render(<ReciboFeedback ideaId="i1" />)
    const box = await screen.findByRole('textbox', { name: /por qué no te gusta/i })
    await user.type(box, 'El corte se ve oscuro')
    await user.click(screen.getByRole('button', { name: /guardar motivo/i }))
    await waitFor(() => {
      expect(addStaffReviewComment).toHaveBeenCalledWith('i1', 'El corte se ve oscuro')
    })
  })

  it('muestra el hilo que ya existe', async () => {
    getReciboReviewComments.mockResolvedValue([
      {
        id: 'c1',
        author_kind: 'staff',
        author_name: 'Eric Perez',
        body: 'El hook no se entiende',
        created_at: '2026-10-05T12:00:00Z',
      },
      {
        id: 'c2',
        author_kind: 'client',
        author_name: 'María',
        body: 'Bajen un poco el volumen',
        created_at: '2026-10-05T12:05:00Z',
      },
    ])
    render(<ReciboFeedback ideaId="i1" />)
    expect(await screen.findByText('El hook no se entiende')).toBeInTheDocument()
    expect(screen.getByText('Bajen un poco el volumen')).toBeInTheDocument()
    expect(screen.getByText('Equipo')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
  })

  it('sin planning.move muestra el hilo pero no el formulario', async () => {
    canMove = false
    getReciboReviewComments.mockResolvedValue([
      {
        id: 'c1',
        author_kind: 'staff',
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
    expect(addStaffReviewComment).not.toHaveBeenCalled()
  })
})
