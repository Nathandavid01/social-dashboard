import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { QcProgressDots } from './qc-progress-dots'
import * as actions from '@/lib/actions/video-analysis'
import * as analysisClient from '@/lib/utils/video-analysis-client'

/**
 * "Tres bolitas" de un vistazo: relevancia, captions sin errores, caption
 * generado. Mismo patrón de fetch/act() que video-analysis-report.test.tsx
 * (fetch real en useEffect, sin timers reales colgando).
 */

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

vi.mock('@/lib/utils/video-analysis-client', () => ({ analyzeExistingVideo: vi.fn() }))
const mockAnalyze = vi.mocked(analysisClient.analyzeExistingVideo)

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
const mockToast = vi.fn()

// Drives whether el usuario puede disparar el análisis (video.upload). Mutable across tests.
let canAnalyze = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => canAnalyze,
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    canAnalyze = true
  })

  it('done + relevancia ok + 0 issues + hay caption → las 3 bolitas en verde con sus textos', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(screen.getByText('Libre de errores')).toBeInTheDocument()
    expect(screen.getByText('Caption generado')).toBeInTheDocument()
  })

  it('done + relevancia warning + 2 issues → bolita 1 ámbar con problema corto, bolita 2 ámbar "2 errores a revisar", con detalle expandible al hacer click', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: warningFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('No parece de este cliente')).toBeInTheDocument())
    expect(screen.getByText('2 errores a revisar')).toBeInTheDocument()

    // El detalle no se ve hasta hacer click en cada bolita ámbar.
    expect(screen.queryByText(/no se menciona al cliente/)).not.toBeInTheDocument()
    expect(screen.queryByText(/clínica/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('No parece de este cliente'))
    expect(screen.getByText(/no se menciona al cliente/)).toBeInTheDocument()

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

  it('con frame_count guardado → línea "N fotogramas analizados" bajo las bolitas', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true, frameCount: 48 } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('48 fotogramas analizados')).toBeInTheDocument())
  })

  it('frame_count === 1 → singular "1 fotograma analizado"', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true, frameCount: 1 } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('1 fotograma analizado')).toBeInTheDocument())
  })

  it('sin frameCount (columna sin migrar / fila vieja) → no muestra la línea del contador', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(screen.queryByText(/fotogramas? analizado/)).not.toBeInTheDocument()
  })
})

describe('QcProgressDots — botón "Analizar con IA" / "Re-analizar" (v3.39)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canAnalyze = true
  })

  it('sin análisis pero con videoId y permiso → sale "Analizar con IA"', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Analizar con IA/ })).toBeInTheDocument())
  })

  it('sin análisis y SIN videoId (no hay video editado) → no renderiza nada, como antes', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('sin análisis, con videoId pero SIN permiso video.upload → no renderiza nada', async () => {
    canAnalyze = false
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('con análisis existente y videoId + permiso → sale "Re-analizar" discreto junto a las bolitas', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByText('Re-analizar')).toBeInTheDocument())
  })

  it('con análisis existente pero SIN permiso → no sale "Re-analizar"', async () => {
    canAnalyze = false
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(screen.queryByText('Re-analizar')).not.toBeInTheDocument()
  })

  it('con análisis existente pero SIN videoId → no sale "Re-analizar" (no hay qué re-analizar)', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(screen.queryByText('Re-analizar')).not.toBeInTheDocument()
  })

  it('click en "Analizar con IA": llama a analyzeExistingVideo(videoId), muestra progreso, y al terminar refresca', async () => {
    mockGet
      .mockResolvedValueOnce({ analysis: null })
      .mockResolvedValueOnce({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    let resolveAnalyze!: (v: { ok: true }) => void
    mockAnalyze.mockReturnValue(new Promise((r) => { resolveAnalyze = r }))

    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    const btn = await screen.findByRole('button', { name: /Analizar con IA/ })
    fireEvent.click(btn)

    // Deshabilitado con spinner mientras corre.
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
    expect(mockAnalyze).toHaveBeenCalledWith('v1', expect.objectContaining({ onProgress: expect.any(Function) }))

    await act(async () => { resolveAnalyze({ ok: true }) })

    // Se refrescó vía el mismo hook → ahora muestra las bolitas.
    await waitFor(() => expect(screen.getByText('Es del cliente')).toBeInTheDocument())
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('click en "Re-analizar" que falla → toast de error, panel sigue en pie', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    mockAnalyze.mockResolvedValue({ error: 'No se pudo cargar el video para analizarlo' })

    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    const btn = await screen.findByText('Re-analizar')
    await act(async () => { fireEvent.click(btn) })

    expect(mockAnalyze).toHaveBeenCalledWith('v1', expect.anything())
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se pudo analizar el video',
      description: 'No se pudo cargar el video para analizarlo',
      variant: 'destructive',
    })))
    // El panel no se rompe: las bolitas siguen visibles.
    expect(screen.getByText('Es del cliente')).toBeInTheDocument()
  })
})
