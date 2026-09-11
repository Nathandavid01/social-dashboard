import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WrittenIdea } from '@/lib/actions/ideas-batch'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}))

vi.mock('@/lib/actions/ideas-batch', () => ({
  createIdeasBatch: vi.fn(async () => ({ ok: true, created: 1 })),
  discardWrittenIdea: vi.fn(async () => ({ ok: true })),
}))

vi.mock('./proposal-pdf-button', () => ({
  ProposalPdfButton: () => null,
}))

import { IdeaBatchTable } from './idea-batch-table'

const existing: WrittenIdea[] = [{
  id: 'i1',
  title: '¿Otro cafecito?',
  objective: 'Aumentar reservas',
  funnelStage: 'BOFU',
  hook: 'Vuelve por el café',
  contentType: 'R',
  shotType: 'sony',
  referenceUrl: null,
  status: 'idea',
  createdAt: '2026-09-11T12:00:00Z',
}]

describe('IdeaBatchTable — objetivos', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('muestra Objetivo en ideas sin grabar cuando viene de getWrittenIdeas', async () => {
    render(<IdeaBatchTable clientId="c1" clientName="Karen" existing={existing} />)
    expect(await screen.findByText(/Objetivo: Aumentar reservas · BOFU/)).toBeInTheDocument()
  })

  it('permite editar objetivo y embudo en la fila de escritura', async () => {
    const user = userEvent.setup()
    render(<IdeaBatchTable clientId="c1" clientName="Karen" existing={[]} />)
    expect(screen.getByRole('columnheader', { name: 'Objetivo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Embudo' })).toBeInTheDocument()

    const obj = await screen.findByLabelText('Objetivo de la idea 1')
    // Esperar a que el efecto de borrador termine de restaurar filas.
    await waitFor(() => {
      expect(screen.getByLabelText('Objetivo de la idea 1')).toBeInTheDocument()
    })
    await user.clear(obj)
    await user.type(screen.getByLabelText('Objetivo de la idea 1'), 'Conversion')
    await waitFor(() => {
      expect(screen.getByLabelText('Objetivo de la idea 1')).toHaveValue('Conversion')
    })

    await user.selectOptions(screen.getByLabelText('Etapa de embudo de la idea 1'), 'BOFU')
    expect(screen.getByLabelText('Etapa de embudo de la idea 1')).toHaveValue('BOFU')
  })
})
