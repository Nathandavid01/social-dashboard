import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
vi.mock('@/lib/actions/idea-client-proposals', () => ({ respondToIdeaProposal: vi.fn(async () => ({ ok: true })) }))
vi.mock('./proposal-pdf-button', () => ({ ProposalPdfButton: () => <button>Descargar PDF para aprobación</button> }))
import { respondToIdeaProposal } from '@/lib/actions/idea-client-proposals'
import { ClientIdeaApproval } from './client-idea-approval'
describe('aprobación del cliente', () => {
  it('exige una decisión y envía el comentario con la idea correcta', async () => {
    const user = userEvent.setup()
    render(<ClientIdeaApproval token={'a'.repeat(64)} clientName="Miti Miti" date="2026-09-10" ideas={[{ id: 'i1', title: 'Cafecito', hook: 'Texto para revisión', referenceUrl: null }]} responses={[]} />)
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled()
    await user.click(screen.getByLabelText('No aprobar'))
    await user.type(screen.getByLabelText('Comentarios'), 'Cambiar el plato')
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }))
    expect(respondToIdeaProposal).toHaveBeenCalledWith({ token: 'a'.repeat(64), ideaId: 'i1', decision: 'rejected', comment: 'Cambiar el plato' })
    expect(await screen.findByText('Respuesta guardada. Gracias.')).toBeInTheDocument()
  })
  it('no presenta un fallo como una aprobación guardada', async () => {
    vi.mocked(respondToIdeaProposal).mockResolvedValueOnce({ error: 'Enlace vencido' })
    const user = userEvent.setup()
    render(<ClientIdeaApproval token={'b'.repeat(64)} clientName="Miti Miti" date="2026-09-10" ideas={[{ id: 'i2', title: 'Postre', hook: null, referenceUrl: null }]} responses={[]} />)
    await user.click(screen.getByLabelText('Aprobar'))
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }))
    expect(await screen.findByText('Enlace vencido')).toBeInTheDocument()
  })
})
