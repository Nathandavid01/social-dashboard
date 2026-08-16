import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { QcProgressDots } from './qc-progress-dots'
import * as actions from '@/lib/actions/video-analysis'

/**
 * "Tres bolitas" de un vistazo: relevancia, captions sin errores, caption
 * generado. Mismo patrón de fetch/act() que video-analysis-report.test.tsx
 * (fetch real en useEffect, sin timers reales colgando).
 */

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

const okFindings = {
  burned_captions: { text: 'Bien escrito', issues: [] },
  relevance: { verdict: 'ok' as const, explanation: 'coincide con el cliente' },
  visual_summary: 'persona hablando a cámara',
}

const warningFindings = {
  burned_captions: {
    text: 'Ven hoy a nuestra clinica',
    issues: [
      { quote: 'clinica', problem: 'falta la tilde', suggestion: 'clínica' },
      { quote: 'Ven hoy', problem: 'falta signo de puntuación', suggestion: 'Ven hoy,' },
    ],
  },
  relevance: { verdict: 'warning' as const, explanation: 'no se menciona al cliente' },
  visual_summary: 'persona hablando a cámara',
}

describe('QcProgressDots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('done + relevancia ok + 0 issues + hay caption → las 3 bolitas en verde con sus textos', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(screen.getByText('Libre de errores')).toBeInTheDocument()
    expect(screen.getByText('Caption generado')).toBeInTheDocument()
  })

  it('done + relevancia warning + 2 issues → bolita 1 ámbar con la explicación, bolita 2 ámbar "2 errores a revisar", con detalle expandible', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: warningFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText(/no se menciona al cliente/)).toBeInTheDocument())
    expect(screen.getByText('2 errores a revisar')).toBeInTheDocument()

    // El detalle de correcciones no se ve hasta hacer click en la bolita ámbar.
    expect(screen.queryByText(/clínica/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('2 errores a revisar'))
    expect(screen.getByText(/clínica/)).toBeInTheDocument()
    expect(screen.getByText(/Ven hoy,/)).toBeInTheDocument()
  })

  it('pending → las dos primeras bolitas en "Analizando…"', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null, hasCaption: false } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getAllByText('Analizando…')).toHaveLength(2))
    // La 3ra bolita (caption) es independiente del estado del QC de video.
    expect(screen.getByText('Generando caption…')).toBeInTheDocument()
  })

  it('sin caption todavía → 3ra bolita "Generando caption…"; con caption → "Caption generado"', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: false } })
    const { rerender } = render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('Generando caption…')).toBeInTheDocument())

    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    rerender(<QcProgressDots ideaId="i1-b" />)
    await waitFor(() => expect(screen.getByText('Caption generado')).toBeInTheDocument())
  })

  it('status error o findings null (fallo del análisis) → "Análisis no disponible" en las dos primeras bolitas', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'error', findings: null, hasCaption: false } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getAllByText('Análisis no disponible')).toHaveLength(2))
  })

  it('analysis: null (migración sin aplicar u otro fallo degradado) → no rompe: no renderiza nada', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('sin warnings de act(): el fetch inicial se resuelve dentro de un solo act', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    await act(async () => {
      render(<QcProgressDots ideaId="i1" />)
      await Promise.resolve()
    })
    expect(screen.getByText('Es del cliente')).toBeInTheDocument()
  })
})
