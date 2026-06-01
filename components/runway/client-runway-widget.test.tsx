import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientRunwayWidget } from './client-runway-widget'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

function pipeline(over: Partial<ClientPipeline> = {}): ClientPipeline {
  return {
    clientId: 'c1', clientName: 'Acme',
    ideas: 12, porGrabar: 0, porEditar: 8, porPublicar: 4,
    publicadasSemana: 0, publicadasMes: 0,
    targetSemana: 4, targetMes: 16, semanaRemaining: 4, mesRemaining: 16,
    ...over,
  }
}

describe('ClientRunwayWidget', () => {
  it('renders the three stage bars in weeks', () => {
    render(<ClientRunwayWidget pipeline={pipeline()} />)
    expect(screen.getByText('Ideas')).toBeInTheDocument()
    expect(screen.getByText('Grabado')).toBeInTheDocument()
    expect(screen.getByText('Editado')).toBeInTheDocument()
    expect(screen.getByText('3 sem')).toBeInTheDocument() // ideas 12/4
    expect(screen.getByText('1 sem')).toBeInTheDocument() // edited 4/4
  })

  it('shows a "configura la cadencia" message when there is no cadence', () => {
    render(<ClientRunwayWidget pipeline={pipeline({ targetSemana: 0 })} />)
    expect(screen.getByText(/Configura la cadencia/i)).toBeInTheDocument()
    expect(screen.queryByText('Ideas')).not.toBeInTheDocument()
  })
})
