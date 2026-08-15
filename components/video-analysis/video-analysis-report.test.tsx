import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { VideoAnalysisReport } from './video-analysis-report'
import * as actions from '@/lib/actions/video-analysis'

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

const findings = {
  burned_captions: { text: 'Ven hoy a nuestra clinica', issues: [{ quote: 'clinica', problem: 'falta la tilde', suggestion: 'clínica' }] },
  relevance: { verdict: 'warning' as const, explanation: 'no se menciona al cliente' },
  visual_summary: 'persona hablando a cámara',
}

describe('VideoAnalysisReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('done con issues: muestra ⚠ en captions, ⚠ en relevancia y el detalle', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings } })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Captions del video/)).toBeInTheDocument())
    expect(screen.getAllByText(/⚠|Revisar/).length).toBeGreaterThan(0)
    expect(screen.getByText(/clínica/)).toBeInTheDocument()
    expect(screen.getByText(/no se menciona al cliente/)).toBeInTheDocument()
  })

  it('done sin issues y relevancia ok: muestra ambos checks en verde', async () => {
    mockGet.mockResolvedValue({
      analysis: {
        status: 'done',
        findings: { ...findings, burned_captions: { text: 'Bien escrito', issues: [] }, relevance: { verdict: 'ok', explanation: 'coincide' } },
      },
    })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Sin errores/)).toBeInTheDocument())
    expect(screen.getByText(/Relevante para el cliente/)).toBeInTheDocument()
  })

  it('pending muestra "Analizando…"; error muestra "Análisis no disponible"', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null } })
    const { unmount } = render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Analizando/)).toBeInTheDocument())
    unmount()
    mockGet.mockResolvedValue({ analysis: { status: 'error', findings: null } })
    render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Análisis no disponible/)).toBeInTheDocument())
  })

  it('sin análisis: no renderiza nada', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<VideoAnalysisReport ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  describe('pending: re-consulta hasta que cambia (timers falsos)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('pending → poll cada 10s → done: deja de mostrar "Analizando…" y muestra el reporte, sin más llamadas tras el cambio', async () => {
      mockGet
        .mockResolvedValueOnce({ analysis: { status: 'pending', findings: null } })
        .mockResolvedValueOnce({ analysis: { status: 'pending', findings: null } })
        .mockResolvedValue({ analysis: { status: 'done', findings } })

      render(<VideoAnalysisReport ideaId="i1" />)
      await act(async () => {})
      expect(screen.getByText(/Analizando/)).toBeInTheDocument()
      expect(mockGet).toHaveBeenCalledTimes(1)

      await act(() => vi.advanceTimersByTimeAsync(10_000))
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(screen.getByText(/Analizando/)).toBeInTheDocument()

      await act(() => vi.advanceTimersByTimeAsync(10_000))
      expect(mockGet).toHaveBeenCalledTimes(3)
      expect(screen.getByText(/Captions del video/)).toBeInTheDocument()

      // Ya en 'done': ya no debe seguir sondeando.
      await act(() => vi.advanceTimersByTimeAsync(30_000))
      expect(mockGet).toHaveBeenCalledTimes(3)
    })

    it('se desmonta con pending: no sigue sondeando (interval limpio)', async () => {
      mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null } })
      const { unmount } = render(<VideoAnalysisReport ideaId="i1" />)
      await act(async () => {})
      expect(mockGet).toHaveBeenCalledTimes(1)

      unmount()
      await act(() => vi.advanceTimersByTimeAsync(30_000))
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('pending que nunca resuelve: se da por vencido a los ~5min y deja de sondear, sin inventar un error', async () => {
      mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null } })
      render(<VideoAnalysisReport ideaId="i1" />)
      await act(async () => {})

      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
      const callsAtCap = mockGet.mock.calls.length
      expect(callsAtCap).toBeGreaterThan(1)
      expect(screen.getByText(/Analizando/)).toBeInTheDocument()

      // Pasado el tope, ya no sondea más.
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(mockGet).toHaveBeenCalledTimes(callsAtCap)
      expect(screen.getByText(/Analizando/)).toBeInTheDocument()
    })
  })
})
