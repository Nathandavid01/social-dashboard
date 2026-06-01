import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunwayHealthCard } from './runway-health-card'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

function pc(over: Partial<ClientPipeline>): ClientPipeline {
  return {
    clientId: 'c', clientName: 'X',
    ideas: 0, porGrabar: 0, porEditar: 0, porPublicar: 0,
    publicadasSemana: 0, publicadasMes: 0,
    targetSemana: 1, targetMes: 4, semanaRemaining: 0, mesRemaining: 0,
    ...over,
  }
}

// 1 week cadence: counts == weeks. 16/16/16 → 16w (ok); 1/1/1 → 1w (risk).
const ok = pc({ clientId: 'a', clientName: 'Acme', ideas: 16, porEditar: 16, porPublicar: 16 })
const risk = pc({ clientId: 'b', clientName: 'Beta', ideas: 1, porEditar: 1, porPublicar: 1 })

describe('RunwayHealthCard', () => {
  it('summarizes how many clients are below one month + lists at-risk names', () => {
    render(<RunwayHealthCard perClient={[ok, risk]} />)
    expect(screen.getByText(/de 2 clientes con/i)).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // 1 behind
  })

  it('shows an all-good message when every client is a month ahead', () => {
    render(<RunwayHealthCard perClient={[ok]} />)
    expect(screen.getByText(/a 1 mes o más/i)).toBeInTheDocument()
  })

  it('prompts to configure cadence when no client has cadence', () => {
    render(<RunwayHealthCard perClient={[pc({ targetSemana: 0 })]} />)
    expect(screen.getByText(/Configura cadencia/i)).toBeInTheDocument()
  })

  it('links to the runway page', () => {
    render(<RunwayHealthCard perClient={[risk]} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/runway')
  })
})
