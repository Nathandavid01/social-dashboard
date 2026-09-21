import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RecordingGapCardsView } from './recording-gap-cards'
import type { RecordingHoyGapsResult } from '@/lib/onsite/recording-hoy-gaps'

afterEach(() => cleanup())

const empty: RecordingHoyGapsResult = {
  visible: true,
  unconfirmed: [],
  sinVideo: [],
  ideasShortfall: [],
  actionableCount: 0,
  actionableIds: [],
}

describe('RecordingGapCardsView', () => {
  it('no se muestra sin recording.read', () => {
    const { container } = render(<RecordingGapCardsView gaps={{ ...empty, visible: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pone las tres tarjetas de huecos aunque estén en cero', () => {
    render(<RecordingGapCardsView gaps={empty} />)
    expect(screen.getByRole('heading', { name: 'Sin confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SIN VIDEO' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Faltan ideas' })).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(3)
  })

  it('lista sesiones accionables y enlaza al calendario o On Site', () => {
    render(
      <RecordingGapCardsView
        gaps={{
          ...empty,
          actionableCount: 2,
          actionableIds: ['a', 'b'],
          unconfirmed: [{ id: 'a', title: 'Blue', date: '2026-09-21', missing: ['hora'] }],
          sinVideo: [{ id: 'b', title: 'Nanas', date: '2026-09-22' }],
          ideasShortfall: [{ id: 'c', title: 'Corto', date: '2026-09-23', ideaCount: 1, slotTarget: 6 }],
        }}
      />,
    )
    expect(screen.getByRole('link', { name: /Blue/ })).toHaveAttribute('href', '/recording-calendar')
    expect(screen.getByRole('link', { name: /Nanas/ })).toHaveAttribute('href', '/recording-calendar')
    expect(screen.getByRole('link', { name: /Corto/ })).toHaveAttribute('href', '/onsite?s=c')
    expect(screen.getByText('1 / 6 ideas')).toBeInTheDocument()
  })
})
