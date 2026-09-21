import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideographerHistory } from './videographer-history'
import type { VideographerHistorySession } from '@/lib/recording/videographer-history'

const sessions: VideographerHistorySession[] = [
  {
    sessionId: 's1',
    sessionTitle: 'Mañana en el parque',
    sessionDate: '2026-09-12',
    clientName: 'Nana',
    ideas: [
      {
        ideaId: 'i1',
        title: 'Hook del mes',
        additional: false,
        videos: [
          { id: 'v1', name: 'primera.mp4', kind: 'raw', status: 'uploaded', uploadedAt: '2026-09-12T15:00:00.000Z' },
        ],
      },
      {
        ideaId: 'i2',
        title: 'DJI_0991',
        additional: true,
        videos: [],
      },
    ],
  },
]

describe('VideographerHistory', () => {
  it('lists videos under their idea and marks the extra idea from the shoot', () => {
    render(<VideographerHistory own sessions={sessions} />)

    expect(screen.getByRole('heading', { name: 'Tu historial de grabación' })).toBeInTheDocument()
    expect(screen.getByText('Nana')).toBeInTheDocument()
    expect(screen.getByText(/Mañana en el parque/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hook del mes' })).toHaveAttribute('href', '/produccion/idea/i1')
    expect(screen.getByText('primera.mp4')).toBeInTheDocument()
    expect(screen.getByText('Crudo')).toBeInTheDocument()
    expect(screen.getByText('DJI_0991')).toBeInTheDocument()
    expect(screen.getByText('Adicional')).toBeInTheDocument()
    expect(screen.getByText('Sin video todavía')).toBeInTheDocument()
  })

  it('names the person when an admin is looking at their history', () => {
    render(<VideographerHistory own={false} personName="Carlos Ruiz" sessions={sessions} />)
    expect(screen.getByRole('heading', { name: 'Historial de grabación de Carlos Ruiz' })).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    render(<VideographerHistory own sessions={[]} />)
    expect(screen.getByText(/todavía no hay videos ni ideas de grabación/i)).toBeInTheDocument()
  })

  it('shows a read error instead of an empty history', () => {
    render(<VideographerHistory own sessions={[]} error="No se pudo leer el historial" />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer el historial')
  })
})
