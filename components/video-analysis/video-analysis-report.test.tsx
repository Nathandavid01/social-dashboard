import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
