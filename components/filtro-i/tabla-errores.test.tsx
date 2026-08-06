import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TablaErrores } from './tabla-errores'
import type { ErrorDetectado } from '@/lib/llm/grok-vision-core'

const err = (over: Partial<ErrorDetectado> = {}): ErrorDetectado => ({
  texto_incorrecto: 'vamos playa',
  correccion: "vamos pa'llá",
  tipo: 'Transcripción',
  momento: '4.8s',
  ...over,
})

describe('TablaErrores', () => {
  it('enseña qué dice, qué debería decir, de qué tipo y cuándo', () => {
    render(<TablaErrores errores={[err()]} />)
    expect(screen.getByText('vamos playa')).toBeInTheDocument()
    expect(screen.getByText("vamos pa'llá")).toBeInTheDocument()
    expect(screen.getByText('Transcripción')).toBeInTheDocument()
    expect(screen.getByText('4.8s')).toBeInTheDocument()
  })

  it('respeta el orden del video, no reordena', () => {
    render(
      <TablaErrores
        errores={[err({ texto_incorrecto: 'primero' }), err({ texto_incorrecto: 'segundo' })]}
      />,
    )
    const filas = screen.getAllByRole('row').slice(1) // fuera la cabecera
    expect(filas[0]).toHaveTextContent('primero')
    expect(filas[1]).toHaveTextContent('segundo')
  })

  /**
   * "Sin errores" es un resultado, no un vacío. Una tabla en blanco se lee como
   * "esto no corrió" y manda al editor a preguntar.
   */
  it('sin errores lo dice en positivo', () => {
    render(<TablaErrores errores={[]} />)
    expect(screen.getByText(/sin errores/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
