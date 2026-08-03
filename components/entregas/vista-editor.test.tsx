import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/pipeline/editor-submit-slot', () => ({
  EditorSubmitSlot: () => <div data-testid="submit" />,
}))

import { VistaEditor, type VideoDevuelto } from './vista-editor'

const clientes = [{ id: 'c1', name: 'La Guira' }]
const devuelto = (over: Partial<VideoDevuelto> = {}): VideoDevuelto => ({
  id: 'v1',
  titulo: 'Reel de agosto',
  clientName: 'La Guira',
  nota: { note: 'Cortar el logo del final', author: 'Tuti', at: '2026-08-03T10:00:00Z' },
  ...over,
})

/**
 * El editor no reparte trabajo del equipo: sube su video con su fecha y ya. Las
 * pestañas de dia y el selector de semana existen para repartir, asi que aqui
 * sobran — y con la fecha por video tampoco decidian nada.
 */
describe('VistaEditor', () => {
  it('lo primero es el formulario de entrega', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[]} />)
    expect(screen.getByTestId('submit')).toBeInTheDocument()
  })

  it('sin pestañas de dia ni selector de semana', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[]} />)
    for (const d of ['Lunes', 'Martes', 'Domingo']) {
      expect(screen.queryByRole('button', { name: d })).toBeNull()
    }
    expect(screen.queryByText(/Esta semana/i)).toBeNull()
  })

  it('sin devueltos no dibuja esa seccion', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[]} />)
    expect(screen.queryByText(/Te devolvieron/i)).toBeNull()
  })

  // Lo unico que le pide accion: sin esto reenviaria el mismo video sin saber
  // que corregir.
  it('enseña lo devuelto con lo que hay que cambiar y quien lo pidio', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[devuelto()]} />)
    expect(screen.getByText(/Te devolvieron 1/)).toBeInTheDocument()
    expect(screen.getByText('Reel de agosto')).toBeInTheDocument()
    expect(screen.getByText('Cortar el logo del final')).toBeInTheDocument()
    expect(screen.getByText(/Tuti/)).toBeInTheDocument()
  })

  it('un devuelto sin nota lo dice, en vez de dejar un hueco', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[devuelto({ nota: null })]} />)
    expect(screen.getByText(/Sin detalle/i)).toBeInTheDocument()
  })

  it('dice de que cliente es cada uno', () => {
    render(<VistaEditor submitClients={clientes} devueltos={[devuelto()]} />)
    expect(screen.getAllByText('La Guira').length).toBeGreaterThan(0)
  })
})
