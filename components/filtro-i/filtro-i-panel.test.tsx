import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./entregar-video', () => ({ EntregarVideo: () => <div data-testid="entregar" /> }))

import { FiltroIPanel } from './filtro-i-panel'
import type { AnalisisResumen } from './analisis-card'

const clientes = [{ id: 'c1', name: 'La Guira' }]

const analisis = (over: Partial<AnalisisResumen> = {}): AnalisisResumen => ({
  id: 'a1',
  videoId: 'v1',
  titulo: 'Reel de agosto',
  clientName: 'La Guira',
  status: 'listo',
  errores: [
    { texto_incorrecto: 'vamos playa', correccion: "vamos pa'llá", tipo: 'Transcripción', momento: '4.8s' },
  ],
  errorPaso: null,
  errorMensaje: null,
  ...over,
})

/**
 * Filtro I es del editor: entregar y ver qué corregir.
 *
 * Los tests del caption son los importantes — que no aparezca aquí es una
 * decisión de producto, no un detalle de maquetación, y sin test se cuela en el
 * primer refactor.
 */
describe('FiltroIPanel', () => {
  it('lleva el sistema de enviar videos dentro', () => {
    render(<FiltroIPanel clients={clientes} analisis={[]} />)
    expect(screen.getByTestId('entregar')).toBeInTheDocument()
  })

  it('se presenta como Filtro I', () => {
    render(<FiltroIPanel clients={clientes} analisis={[]} />)
    expect(screen.getByRole('heading', { name: 'Filtro I' })).toBeInTheDocument()
  })

  it('enseña la tabla de errores de lo entregado', () => {
    render(<FiltroIPanel clients={clientes} analisis={[analisis()]} />)
    expect(screen.getByText('Reel de agosto')).toBeInTheDocument()
    expect(screen.getByText('vamos playa')).toBeInTheDocument()
    expect(screen.getByText("vamos pa'llá")).toBeInTheDocument()
  })

  /** El editor no ve el caption. Ni el texto, ni la palabra. */
  it('no enseña el caption por ninguna parte', () => {
    render(
      <FiltroIPanel
        clients={clientes}
        analisis={[analisis({ status: 'redactando' })]}
      />,
    )
    expect(screen.queryByText(/caption/i)).toBeNull()
  })

  /** 'redactando' significa que su tabla ya está; lo que sigue no es suyo. */
  it('en redactando le dice Listo, no que se está escribiendo un caption', () => {
    render(<FiltroIPanel clients={clientes} analisis={[analisis({ status: 'redactando' })]} />)
    expect(screen.getByText('Listo')).toBeInTheDocument()
  })

  it('no dibuja el tablero por etapas ni pestañas de día', () => {
    render(<FiltroIPanel clients={clientes} analisis={[]} />)
    for (const t of ['Aprobación', 'Copy', 'Publicación', 'Lunes', 'Domingo']) {
      expect(screen.queryByText(t)).toBeNull()
    }
  })

  it('sin clientes asignados avisa en vez de enseñar el formulario', () => {
    render(<FiltroIPanel clients={[]} analisis={[]} />)
    expect(screen.queryByTestId('entregar')).toBeNull()
    expect(screen.getByText(/no tienes clientes asignados/i)).toBeInTheDocument()
  })

  /**
   * Un fallo de transcripción no mata el análisis — Grok revisa igual lo que
   * ve —, pero la tabla resultante NO cachea los subtítulos que dicen otra
   * cosa de la que se dijo. Si eso no se avisa, parece completa y no lo es.
   */
  it('avisa cuando la tabla se hizo sin oír el audio', () => {
    render(
      <FiltroIPanel
        clients={clientes}
        analisis={[analisis({ status: 'listo', errorPaso: 'transcribir' })]}
      />,
    )
    expect(screen.getByText(/revisado sin audio/i)).toBeInTheDocument()
    // La tabla sigue estando: lo que se pudo revisar, se revisó.
    expect(screen.getByText('vamos playa')).toBeInTheDocument()
  })

  it('con audio no mete un aviso que no toca', () => {
    render(<FiltroIPanel clients={clientes} analisis={[analisis()]} />)
    expect(screen.queryByText(/revisado sin audio/i)).toBeNull()
  })

  it('sin nada entregado no dibuja la sección', () => {
    render(<FiltroIPanel clients={clientes} analisis={[]} />)
    expect(screen.queryByText(/lo que has entregado/i)).toBeNull()
  })
})
