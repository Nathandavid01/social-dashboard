import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrokIngPanel } from './grok-ing-panel'
import type { AnalisisGrokIng } from '@/lib/filtro-i/consultas'

const item = (over: Partial<AnalisisGrokIng> = {}): AnalisisGrokIng => ({
  id: 'a1',
  videoId: 'v1',
  titulo: 'Reel de agosto',
  clientName: 'La Guira',
  clientId: 'c1',
  status: 'listo',
  errores: [],
  errorMensaje: null,
  captionBase: 'El equipo recorre la sucursal nueva.',
  captionFinal: '¡Llegamos a la nueva sucursal! 🔥 #LaGuira',
  ...over,
})

/**
 * Grok-ing enseña el caption. Es lo contrario de Filtro I, y por eso son dos
 * áreas: aquí el caption es el entregable.
 */
describe('GrokIngPanel', () => {
  it('enseña el caption final', () => {
    render(<GrokIngPanel analisis={[item()]} />)
    expect(screen.getByText('¡Llegamos a la nueva sucursal! 🔥 #LaGuira')).toBeInTheDocument()
  })

  it('dice de qué video y de qué cliente es', () => {
    render(<GrokIngPanel analisis={[item()]} />)
    expect(screen.getByText('Reel de agosto')).toBeInTheDocument()
    expect(screen.getByText('La Guira')).toBeInTheDocument()
  })

  /** Cuando el caption no convence hay que poder ver de dónde salió. */
  it('deja ver el caption base como materia prima', () => {
    render(<GrokIngPanel analisis={[item()]} />)
    expect(screen.getByText('El equipo recorre la sucursal nueva.')).toBeInTheDocument()
  })

  /** Aquí sí se dice: en esta pantalla el estado del caption es información útil. */
  it('mientras se escribe el caption lo dice', () => {
    render(<GrokIngPanel analisis={[item({ status: 'redactando', captionFinal: null })]} />)
    expect(screen.getByText(/escribiendo el caption/i)).toBeInTheDocument()
  })

  it('un análisis fallido enseña por qué', () => {
    render(
      <GrokIngPanel
        analisis={[item({ status: 'error', captionFinal: null, errorMensaje: 'WhisperAPI 401' })]}
      />,
    )
    expect(screen.getByText('WhisperAPI 401')).toBeInTheDocument()
  })

  it('sin nada explica de dónde saldrán los captions', () => {
    render(<GrokIngPanel analisis={[]} />)
    expect(screen.getByText(/pasa por filtro i/i)).toBeInTheDocument()
  })
})
