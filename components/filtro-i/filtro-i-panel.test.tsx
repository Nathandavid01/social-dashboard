import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/pipeline/editor-submit-slot', () => ({
  EditorSubmitSlot: () => <div data-testid="submit" />,
}))

import { FiltroIPanel } from './filtro-i-panel'

const clientes = [{ id: 'c1', name: 'La Guira' }]

/**
 * Filtro I es una pantalla de una sola cosa: enviar el video.
 *
 * Nada de tablero por etapas, nada de devueltos, nada de pestañas de día —
 * eso es Revisión y Entregas, y esta área no las toca ni las imita.
 */
describe('FiltroIPanel', () => {
  it('lleva el sistema de enviar videos dentro', () => {
    render(<FiltroIPanel clients={clientes} />)
    expect(screen.getByTestId('submit')).toBeInTheDocument()
  })

  it('se presenta como Filtro I', () => {
    render(<FiltroIPanel clients={clientes} />)
    expect(screen.getByRole('heading', { name: 'Filtro I' })).toBeInTheDocument()
  })

  it('no dibuja el tablero por etapas', () => {
    render(<FiltroIPanel clients={clientes} />)
    for (const etapa of ['Aprobación', 'Copy', 'Publicación']) {
      expect(screen.queryByText(etapa)).toBeNull()
    }
  })

  it('no dibuja devueltos ni pestañas de día', () => {
    render(<FiltroIPanel clients={clientes} />)
    expect(screen.queryByText(/Te devolvieron/i)).toBeNull()
    for (const d of ['Lunes', 'Martes', 'Domingo']) {
      expect(screen.queryByRole('button', { name: d })).toBeNull()
    }
  })

  /** Sin clientes que ofrecer, el formulario no sirve: dilo en vez de dejar un
   *  desplegable vacío que parece roto. */
  it('sin clientes asignados avisa en vez de enseñar el formulario', () => {
    render(<FiltroIPanel clients={[]} />)
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(screen.getByText(/no tienes clientes asignados/i)).toBeInTheDocument()
  })
})
