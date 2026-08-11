import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

/**
 * El bug que originó todo esto: al cambiar de cliente la tabla NO se
 * reiniciaba, así que lo escrito para un cliente se guardaba en el siguiente.
 * Aquí se fija el contrato: cada cliente tiene lo suyo, se autoguarda, y no se
 * sale con trabajo sin enviar sin avisar.
 */

const toast = vi.fn()
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const createIdeasBatch = vi.fn(async () => ({ ok: true as const, created: 1 }))
const discardWrittenIdea = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/ideas-batch', () => ({
  createIdeasBatch: (...a: unknown[]) => createIdeasBatch(...(a as [])),
  discardWrittenIdea: (...a: unknown[]) => discardWrittenIdea(...(a as [])),
}))

const saveIdeaDraft = vi.fn(async () => ({ ok: true as const }))
const deleteIdeaDraft = vi.fn(async () => ({ ok: true as const }))
const getIdeaDraft = vi.fn(async () => ({ rows: null as unknown }))
vi.mock('@/lib/actions/idea-drafts', () => ({
  saveIdeaDraft: (...a: unknown[]) => saveIdeaDraft(...(a as [])),
  deleteIdeaDraft: (...a: unknown[]) => deleteIdeaDraft(...(a as [])),
  getIdeaDraft: (...a: unknown[]) => getIdeaDraft(...(a as [])),
}))

import { IdeaBatchTable } from './idea-batch-table'
import { emptyIdeaRow } from '@/lib/ideas/batch-entry'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

const titulo = (n = 1) => screen.getByLabelText(`Título de la idea ${n}`)

describe('IdeaBatchTable — lo escrito es de SU cliente', () => {
  it('reabre el borrador del cliente en vez de una tabla en blanco', () => {
    render(
      <IdeaBatchTable
        clientId="c1"
        clientName="Kseros"
        existing={[]}
        draft={[{ ...emptyIdeaRow(), title: 'Reel del café' }]}
      />,
    )
    expect(titulo()).toHaveValue('Reel del café')
  })

  it('guarda el borrador contra el cliente que se está viendo', async () => {
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)
    fireEvent.change(titulo(), { target: { value: 'Idea de Kseros' } })

    await waitFor(
      () => expect(saveIdeaDraft).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c1', rows: [expect.objectContaining({ title: 'Idea de Kseros' })] }),
      ),
      { timeout: 4000 },
    )
  })

  // La regresión: enviar tiene que llevar el cliente que se está viendo, y al
  // enviarlo el borrador deja de existir.
  it('al enviar, guarda en el cliente visible y borra su borrador', async () => {
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)
    fireEvent.change(titulo(), { target: { value: 'Idea de Kseros' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(createIdeasBatch).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c1' }),
    ))
    await waitFor(() => expect(deleteIdeaDraft).toHaveBeenCalledWith('c1'))
  })
})

describe('IdeaBatchTable — el borrador se pide al cliente, no se confía en la caché', () => {
  // Volver a la pestaña de un cliente sirve la página desde la caché del router
  // de Next, que se renderizó ANTES de existir el borrador. Si solo se mirara la
  // prop, lo escrito parecería perdido.
  it('pide el borrador al montar y lo pone si la tabla está intacta', async () => {
    getIdeaDraft.mockResolvedValueOnce({ rows: [{ ...emptyIdeaRow(), title: 'Lo que dejé a medias' }] })
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)

    await waitFor(() => expect(getIdeaDraft).toHaveBeenCalledWith('c1'))
    await waitFor(() => expect(titulo()).toHaveValue('Lo que dejé a medias'))
  })

  it('no pisa lo que la persona ya escribió mientras llegaba la respuesta', async () => {
    let resolver: (v: { rows: unknown }) => void = () => {}
    getIdeaDraft.mockReturnValueOnce(new Promise((r) => { resolver = r }) as never)
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)

    fireEvent.change(titulo(), { target: { value: 'Escrito ahora mismo' } })
    resolver({ rows: [{ ...emptyIdeaRow(), title: 'Borrador viejo' }] })

    await waitFor(() => expect(titulo()).toHaveValue('Escrito ahora mismo'))
  })
})

describe('IdeaBatchTable — no se sale con trabajo sin enviar', () => {
  it('con la tabla vacía, salir no avisa', () => {
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)
    expect(screen.queryByText(/sin enviar/i)).toBeNull()
  })

  it('avisa en la propia pantalla en cuanto hay algo escrito', () => {
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)
    fireEvent.change(titulo(), { target: { value: 'A medio escribir' } })
    expect(screen.getByText(/sin enviar/i)).toBeInTheDocument()
  })

  it('el aviso desaparece al enviarlas', async () => {
    render(<IdeaBatchTable clientId="c1" clientName="Kseros" existing={[]} draft={null} />)
    fireEvent.change(titulo(), { target: { value: 'A medio escribir' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(screen.queryByText(/sin enviar/i)).toBeNull())
  })
})
